import type { TranskunBuffers } from './buffers'
import { TranskunMelFrontEnd } from './melFrontEnd'
import { TranskunModel, TranskunHeadsModel } from './onnxModel'
import { semiCrfDecode, type Interval } from './viterbi'
import { ATTR_DIM, CTX_DIM, SUSTAIN_SYMBOL, VELOCITY_CLASSES } from './params'
import type { MidiNote, PedalChange } from './midiWriter'

interface TkNote {
  pitch: number
  start: number
  end: number
  hasOnset: boolean
  hasOffset: boolean
  velocity: number
}

export interface TranscribeProgress {
  segmentsDone: number
  segmentsTotal: number
  stage: 'mel' | 'onnx' | 'viterbi' | 'heads' | 'merge'
}

export interface TranscribeResult {
  notes: MidiNote[]
  pedal: PedalChange[]
  noteCount: number
}

function compareByTime(a: TkNote, b: TkNote): number {
  if (a.start !== b.start) return a.start - b.start
  if (a.end !== b.end) return a.end - b.end
  return a.pitch - b.pitch
}

function argMax(a: Float32Array, offset: number, count: number): number {
  let best = 0
  let bestVal = a[offset]
  for (let i = 1; i < count; i++) {
    if (a[offset + i] > bestVal) {
      bestVal = a[offset + i]
      best = i
    }
  }
  return best
}

// transkun's sub-frame value: the mean of a ContinuousBernoulli(logits), recentred to
// [-0.5, 0.5]. The closed form is numerically unstable near p=0.5, so it Taylor-expands
// there (matches the reference implementation, itself matching torch's).
function ofValue(logit: number): number {
  const p = 1.0 / (1.0 + Math.exp(-logit))
  let mean: number
  if (p < 0.499 || p > 0.501) {
    mean = p / (2.0 * p - 1.0) + 1.0 / (Math.log(1.0 - p) - Math.log(p))
  } else {
    const x = p - 0.5
    mean = 0.5 + (1.0 / 3.0 + (16.0 / 45.0) * x * x) * x
  }
  return Math.max(-0.5, Math.min(0.5, (mean - 0.5) / 0.99))
}

/**
 * The Transkun engine, ported from AudioClaudio's TranskunTranscriber.cs: mono audio ->
 * mel front end -> the exported ONNX -> the semi-CRF decode -> note + pedal intervals, over
 * the model's 16s/8s overlapping segments, stitched. The note-drop rules, the
 * forcedStartPos carry, the merge-across-segments and the final overlap resolution are
 * ported exactly, so a boundary-spanning note is recovered once.
 */
export class TranskunTranscriber {
  private readonly mel: TranskunMelFrontEnd
  private readonly fs: number
  private readonly hop: number
  private readonly padSamples: number
  private readonly startFrameIdx: number
  private readonly stepSamples: number
  private readonly stepFrames: number
  private readonly segSamples: number
  private readonly lastFrameIdx: number
  private readonly frameDur: number
  private readonly padSeconds: number
  private readonly nMels: number
  private readonly nWindows: number

  constructor(
    private readonly buffers: TranskunBuffers,
    private readonly model: TranskunModel,
    private readonly heads: TranskunHeadsModel
  ) {
    this.mel = new TranskunMelFrontEnd(buffers)
    const p = buffers.params
    this.fs = p.fs
    this.hop = p.hopSize
    this.nMels = p.nMels
    this.nWindows = p.nWindows
    this.frameDur = this.hop / this.fs
    this.padSeconds = p.segmentSizeSeconds - p.segmentHopSeconds // 8s
    this.padSamples = Math.ceil(this.padSeconds * this.fs)
    this.startFrameIdx = Math.floor((this.padSeconds * this.fs) / this.hop)
    this.stepSamples = Math.ceil((p.segmentHopSeconds * this.fs) / this.hop) * this.hop
    this.stepFrames = this.stepSamples / this.hop
    this.segSamples = Math.ceil(p.segmentSizeSeconds * this.fs)
    this.lastFrameIdx = Math.round(this.segSamples / this.hop)
  }

  async transcribe(
    audio: Float32Array,
    onProgress?: (p: TranscribeProgress) => void
  ): Promise<TranscribeResult> {
    const events = await this.decodeAllSegments(audio, onProgress)
    return {
      notes: this.buildNotes(events),
      pedal: this.buildPedal(events),
      noteCount: events.filter((e) => e.pitch > 0).length
    }
  }

  private async decodeAllSegments(
    audio: Float32Array,
    onProgress?: (p: TranscribeProgress) => void
  ): Promise<TkNote[]> {
    const padSamples = this.padSamples
    const n = padSamples + audio.length + padSamples
    const x = new Float32Array(n)
    x.set(audio, padSamples)

    const nSym = this.buffers.symbols.length
    const eventsByType = new Map<number, TkNote[]>()
    const startPos = new Int32Array(nSym).fill(this.startFrameIdx)

    const segmentsTotal = Math.max(1, Math.ceil(n / this.stepSamples))
    let segIdx = 0

    const segment = new Float32Array(this.segSamples)
    for (let i = 0; i < n; i += this.stepSamples) {
      const len = Math.min(this.segSamples, n - i)
      segment.fill(0)
      segment.set(x.subarray(i, i + len))
      const beginTime = i / this.fs - this.padSeconds

      onProgress?.({ segmentsDone: segIdx, segmentsTotal, stage: 'mel' })
      const { features, nFrame } = this.mel.compute(segment)
      // Yield to the event loop so the UI can repaint between the heavy synchronous steps.
      await new Promise((r) => setTimeout(r, 0))

      onProgress?.({ segmentsDone: segIdx, segmentsTotal, stage: 'onnx' })
      const { s, ctx, t } = await this.model.run(features, nFrame, this.nMels, this.nWindows)

      onProgress?.({ segmentsDone: segIdx, segmentsTotal, stage: 'viterbi' })
      const intervals = semiCrfDecode(s, t, nSym, startPos)
      await new Promise((r) => setTimeout(r, 0))

      onProgress?.({ segmentsDone: segIdx, segmentsTotal, stage: 'heads' })
      const curEvents = await this.buildSegmentEvents(intervals, ctx, t, beginTime, startPos)

      onProgress?.({ segmentsDone: segIdx, segmentsTotal, stage: 'merge' })
      this.mergeSegment(curEvents, eventsByType)

      segIdx++
      onProgress?.({ segmentsDone: segIdx, segmentsTotal, stage: 'merge' })
    }

    // At true EOF force-close the last note per track, then drop any still-open fragment.
    const all: TkNote[] = []
    for (const list of eventsByType.values()) {
      if (list.length > 0) list[list.length - 1].hasOffset = true
      for (const e of list) if (e.hasOffset) all.push(e)
    }

    return this.resolveOverlapping(all)
  }

  private async buildSegmentEvents(
    intervals: Interval[][],
    ctx: Float32Array,
    t: number,
    beginTime: number,
    startPos: Int32Array
  ): Promise<TkNote[]> {
    const nSym = this.buffers.symbols.length

    let nIntervals = 0
    for (let track = 0; track < nSym; track++) nIntervals += intervals[track].length

    const attr = new Float32Array(nIntervals * ATTR_DIM)
    let row = 0
    for (let track = 0; track < nSym; track++) {
      for (const iv of intervals[track]) {
        const baseA = (track * t + iv.begin) * CTX_DIM
        const baseB = (track * t + iv.end) * CTX_DIM
        const o = row * ATTR_DIM
        for (let d = 0; d < CTX_DIM; d++) {
          const a = ctx[baseA + d]
          const b = ctx[baseB + d]
          attr[o + d] = a
          attr[o + CTX_DIM + d] = b
          attr[o + 2 * CTX_DIM + d] = a * b
        }
        row++
      }
    }

    const { velLogits, ofRaw } = await this.heads.run(attr, nIntervals)

    const curEvents: TkNote[] = []
    let cursor = 0
    for (let track = 0; track < nSym; track++) {
      const pitch = this.buffers.symbols[track]
      let lastEnd = 0.0
      let lastClosedEnd = 0
      for (const iv of intervals[track]) {
        const velocity = Math.max(
          1,
          Math.min(127, argMax(velLogits, cursor * VELOCITY_CLASSES, VELOCITY_CLASSES))
        )
        const of0 = ofValue(ofRaw[cursor * 4 + 0])
        const of1 = ofValue(ofRaw[cursor * 4 + 1])
        const presence0 = ofRaw[cursor * 4 + 2] > 0
        const presence1 = ofRaw[cursor * 4 + 3] > 0
        cursor++

        let start = (iv.begin + of0) * this.frameDur
        let end = (iv.end + of1) * this.frameDur
        start = Math.max(start, lastEnd)
        end = Math.max(end, start + 1e-8)
        lastEnd = end

        const hasOnset = iv.begin > 0 || presence0
        const hasOffset = iv.end < this.lastFrameIdx || presence1
        if (hasOffset) lastClosedEnd = iv.end

        const shiftedStart = Math.max(start + beginTime, 0.0)
        curEvents.push({
          pitch,
          start: shiftedStart,
          end: Math.max(end + beginTime, shiftedStart),
          hasOnset,
          hasOffset,
          velocity
        })
      }
      startPos[track] = Math.max(lastClosedEnd - this.stepFrames, 0)
    }

    curEvents.sort(compareByTime)
    return curEvents
  }

  // Overlap + new onset replaces; overlap + no onset extends (stitches a continuation);
  // no overlap + onset appends; no overlap + no onset drops.
  private mergeSegment(curEvents: TkNote[], eventsByType: Map<number, TkNote[]>): void {
    for (const e of curEvents) {
      let list = eventsByType.get(e.pitch)
      if (!list) {
        list = []
        eventsByType.set(e.pitch, list)
      }

      if (list.length > 0 && e.start < list[list.length - 1].end) {
        if (e.hasOnset) {
          list[list.length - 1] = e
        } else {
          const last = list[list.length - 1]
          last.end = Math.max(e.end, last.end)
          last.hasOffset = e.hasOffset
        }
        continue
      }

      if (e.hasOnset) list.push(e)
    }
  }

  // transkun's resolveOverlapping: per pitch, truncate a note's end to the next same-pitch
  // note's start, then drop anything collapsed to non-positive length.
  private resolveOverlapping(events: TkNote[]): TkNote[] {
    events.sort(compareByTime)
    const lastByPitch = new Map<number, TkNote>()
    for (const e of events) {
      const prev = lastByPitch.get(e.pitch)
      if (prev && e.start < prev.end) prev.end = e.start
      lastByPitch.set(e.pitch, e)
    }
    const kept = events.filter((e) => e.start < e.end)
    kept.sort(compareByTime)
    return kept
  }

  private buildNotes(events: TkNote[]): MidiNote[] {
    const notes: MidiNote[] = []
    for (const e of events) {
      if (e.pitch <= 0 || e.pitch < 21 || e.pitch > 108) continue
      const onset = Math.round(e.start * this.fs)
      const end = Math.round(e.end * this.fs)
      const duration = Math.max(1, end - onset)
      notes.push({ pitch: e.pitch, onsetSample: onset, durationSample: duration, velocity: e.velocity })
    }
    notes.sort((a, b) => (a.onsetSample !== b.onsetSample ? a.onsetSample - b.onsetSample : a.pitch - b.pitch))
    return notes
  }

  // Only the sustain track (CC64) feeds the notation pedal path; the soft pedal (CC67) is
  // decoded but not emitted, matching the reference's documented core-first limitation.
  private buildPedal(events: TkNote[]): PedalChange[] {
    const pedal: PedalChange[] = []
    const sustainEvents = events.filter((e) => e.pitch === SUSTAIN_SYMBOL).sort((a, b) => a.start - b.start)
    for (const e of sustainEvents) {
      pedal.push({ sample: Math.round(e.start * this.fs), on: true })
      pedal.push({ sample: Math.round(e.end * this.fs), on: false })
    }
    return pedal
  }
}
