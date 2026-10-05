const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const BEAT_UNITS: Record<string, number> = { whole: 1, half: 2, quarter: 4, eighth: 8, sixteenth: 16, '32nd': 32, '64th': 64 }
const DEFAULT_BPM = 120

export interface TimedLyricEntry { text: string; startUs: number; endUs: number }

function base64ToBytes(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Minimal zip reader for .mxl: extract the inner .xml entry. */
export async function decompressMxlBase64(base64: string): Promise<string | null> {
  const arr = base64ToBytes(base64)
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength)

  let eocd = -1
  for (let i = arr.length - 22; i >= 0 && i > arr.length - 65536; i--) {
    if (arr[i] === 0x50 && arr[i + 1] === 0x4b && arr[i + 2] === 0x05 && arr[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null

  const cdOffset = view.getUint32(eocd + 16, true)
  const cdCount = view.getUint16(eocd + 10, true)

  let cursor = cdOffset
  for (let e = 0; e < cdCount; e++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) return null
    const method = view.getUint16(cursor + 10, true)
    const compSize = view.getUint32(cursor + 20, true)
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localHeaderOffset = view.getUint32(cursor + 42, true)
    const name = new TextDecoder().decode(arr.subarray(cursor + 46, cursor + 46 + nameLen))

    if (name.toLowerCase().endsWith('.xml')) {
      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) return null
      const lfNameLen = view.getUint16(localHeaderOffset + 26, true)
      const lfExtraLen = view.getUint16(localHeaderOffset + 28, true)
      const dataStart = localHeaderOffset + 30 + lfNameLen + lfExtraLen
      const compData = arr.subarray(dataStart, dataStart + compSize)

      if (method === 0) return new TextDecoder('utf-8').decode(compData)
      if (method === 8) {
        const decompressed = new Response(new Blob([compData]).stream().pipeThrough(new DecompressionStream('deflate-raw')))
        const inflated = new Uint8Array(await decompressed.arrayBuffer())
        return new TextDecoder('utf-8').decode(inflated)
      }
      return null
    }

    cursor += 46 + nameLen + extraLen + commentLen
  }
  return null
}

function pitchToMidi(pitch: Element): number | null {
  const step = pitch.getElementsByTagName('step')[0]?.textContent ?? ''
  const octave = Number(pitch.getElementsByTagName('octave')[0]?.textContent)
  const alter = Number(pitch.getElementsByTagName('alter')[0]?.textContent ?? 0)
  const base = STEPS[step]
  if (base === undefined || !Number.isFinite(octave)) return null
  return (octave + 1) * 12 + base + alter
}

function parseEndingNumbers(attr: string | null): number[] {
  if (!attr) return []
  return attr.split(/[\s,]+/).map(s => Number(s)).filter(n => Number.isFinite(n) && n > 0)
}

export interface MeasureRepeatMeta {
  forwardRepeat: boolean
  backwardRepeat: boolean
  backwardTimes: number
  endingNumbers: number[]
}

interface RawMeasure {
  forwardRepeat: boolean
  backwardRepeat: boolean
  backwardTimes: number
  endings: Array<{ numbers: number[]; type: string }>
  items: MeasureItem[]
}

interface ParsedNote {
  midi: number | null
  quarters: number
  chord: boolean
  grace: boolean
  tieStart: boolean
  tieStop: boolean
  lyric: string | null
}

type MeasureItem =
  | { kind: 'note'; note: ParsedNote }
  | { kind: 'backup'; quarters: number }
  | { kind: 'forward'; quarters: number }
  | { kind: 'tempo'; bpm: number }

interface RawPart { measures: RawMeasure[] }

/** Verse-1 lyric only: prefer <lyric number="1">, else an unnumbered one. */
function verseOneLyric(note: Element): string | null {
  let fallback: string | null = null
  for (const lyric of Array.from(note.getElementsByTagName('lyric'))) {
    const number = lyric.getAttribute('number')
    const text = lyric.getElementsByTagName('text')[0]?.textContent?.trim() ?? ''
    if (number === '1') return text || null
    if (fallback === null && !number) fallback = text
  }
  return fallback
}

function parseTempo(direction: Element): number | null {
  const sound = direction.getElementsByTagName('sound')[0]
  if (sound) {
    const tempo = Number(sound.getAttribute('tempo'))
    if (tempo > 0) return tempo
  }
  const metronome = direction.getElementsByTagName('metronome')[0]
  if (metronome) {
    const unit = metronome.getElementsByTagName('beat-unit')[0]?.textContent?.trim() ?? ''
    const perMinute = Number(metronome.getElementsByTagName('per-minute')[0]?.textContent)
    const factor = BEAT_UNITS[unit]
    if (factor && perMinute > 0) return perMinute * (4 / factor)
  }
  return null
}

function parseNote(note: Element, divisions: number): ParsedNote {
  const pitch = note.getElementsByTagName('pitch')[0]
  const durationDiv = Number(note.getElementsByTagName('duration')[0]?.textContent) || 0
  let tieStart = false
  let tieStop = false
  for (const tie of Array.from(note.getElementsByTagName('tie'))) {
    const type = tie.getAttribute('type')
    if (type === 'start') tieStart = true
    if (type === 'stop') tieStop = true
  }
  return {
    midi: pitch ? pitchToMidi(pitch) : null,
    quarters: durationDiv / divisions,
    chord: note.getElementsByTagName('chord').length > 0,
    grace: note.getElementsByTagName('grace').length > 0,
    tieStart,
    tieStop,
    lyric: verseOneLyric(note),
  }
}

function parsePart(part: Element): RawPart {
  const measures: RawMeasure[] = []
  let divisions = 480
  for (const measure of Array.from(part.getElementsByTagName('measure'))) {
    let forwardRepeat = false
    let backwardRepeat = false
    let backwardTimes = 2
    const endings: Array<{ numbers: number[]; type: string }> = []

    for (const barline of Array.from(measure.getElementsByTagName('barline'))) {
      const location = barline.getAttribute('location') ?? 'right'
      const repeat = barline.getElementsByTagName('repeat')[0]
      if (repeat) {
        const direction = repeat.getAttribute('direction')
        if (direction === 'forward' && location === 'left') forwardRepeat = true
        if (direction === 'backward' && location === 'right') {
          backwardRepeat = true
          backwardTimes = Number(repeat.getAttribute('times')) || 2
        }
      }
      for (const endingEl of Array.from(barline.getElementsByTagName('ending'))) {
        endings.push({ numbers: parseEndingNumbers(endingEl.getAttribute('number')), type: endingEl.getAttribute('type') ?? 'start' })
      }
    }

    const items: MeasureItem[] = []
    for (const child of Array.from(measure.children)) {
      const tag = child.tagName
      if (tag === 'attributes') {
        const div = Number(child.getElementsByTagName('divisions')[0]?.textContent)
        if (div > 0) divisions = div
      } else if (tag === 'direction') {
        const bpm = parseTempo(child)
        if (bpm !== null) items.push({ kind: 'tempo', bpm })
      } else if (tag === 'note') {
        items.push({ kind: 'note', note: parseNote(child, divisions) })
      } else if (tag === 'backup' || tag === 'forward') {
        const quarters = (Number(child.getElementsByTagName('duration')[0]?.textContent) || 0) / divisions
        items.push({ kind: tag, quarters })
      }
    }
    measures.push({ forwardRepeat, backwardRepeat, backwardTimes, endings, items })
  }
  return { measures }
}

/**
 * Expand forward/backward repeats and first/second endings into the playback
 * measure order. ponytail: D.S./D.C./Coda jumps not supported — add when
 * songs with those markers appear.
 */
export function expandMeasureOrder(meta: MeasureRepeatMeta[]): number[] {
  const n = meta.length
  const order: number[] = []
  const guard = new Set<string>()
  let i = 0
  let activeStart = -1
  let activePass = 1

  while (i < n) {
    const key = `${i}:${activePass}:${activeStart}`
    if (guard.has(key)) break
    guard.add(key)

    const m = meta[i]
    if (m.endingNumbers.length && !m.endingNumbers.includes(activePass)) {
      i++
      continue
    }
    order.push(i)

    if (m.backwardRepeat && activeStart >= 0) {
      if (activePass < m.backwardTimes) {
        activePass++
        i = activeStart
        continue
      }
    }
    // Reset the pass counter only when entering a NEW repeat section, not
    // when jumping back to the section we are already repeating.
    if (m.forwardRepeat && activeStart !== i) {
      activeStart = i
      activePass = 1
    }
    i++
  }
  return order
}

interface Timeline {
  startQ: number[]
  startSec: number[]
  durSec: number[]
  timeAt: (quarter: number) => number
  bpmAt: (quarter: number) => number
}

/** Walk the reference (first) part to build measure start times and the tempo map. */
function buildTimeline(parts: RawPart[]): Timeline {
  const reference = parts[0]
  const events: Array<{ atQuarter: number; bpm: number }> = []
  const startQ: number[] = []
  let posQ = 0

  for (const measure of reference.measures) {
    startQ.push(posQ)
    let intra = 0
    for (const item of measure.items) {
      if (item.kind === 'tempo') events.push({ atQuarter: posQ + intra, bpm: item.bpm })
      else if (item.kind === 'note') { if (!item.note.grace && !item.note.chord) intra += item.note.quarters }
      else if (item.kind === 'backup') intra -= item.quarters
      else if (item.kind === 'forward') intra += item.quarters
    }
    posQ += intra
  }

  const sorted = [...events].sort((a, b) => a.atQuarter - b.atQuarter)
  const segments: Array<{ from: number; bpm: number }> = []
  let from = 0
  let bpm = DEFAULT_BPM
  for (const event of sorted) {
    if (event.atQuarter <= from) { bpm = event.bpm; continue }
    segments.push({ from, bpm })
    from = event.atQuarter
    bpm = event.bpm
  }
  segments.push({ from, bpm })

  const timeAt = (quarter: number): number => {
    let seconds = 0
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      if (quarter <= segment.from) break
      const end = i + 1 < segments.length ? segments[i + 1].from : Math.max(quarter, segment.from)
      seconds += (Math.min(quarter, end) - segment.from) * (60 / segment.bpm)
    }
    return seconds
  }
  const bpmAt = (quarter: number): number => {
    let active = DEFAULT_BPM
    for (const segment of segments) {
      if (segment.from <= quarter) active = segment.bpm
      else break
    }
    return active
  }

  const measureCount = reference.measures.length
  const startSec = startQ.map(timeAt)
  const durSec = startSec.map((seconds, index) => (index + 1 < measureCount ? startSec[index + 1] : timeAt(posQ)) - seconds)
  return { startQ, startSec, durSec, timeAt, bpmAt }
}

/** Total sung duration (in quarters) of each note, extending through its tie chain. */
function computeTieEnds(flat: ParsedNote[]): number[] {
  const ends = flat.map(note => note.quarters)
  for (let i = 0; i < flat.length; i++) {
    const note = flat[i]
    if (!note.tieStart || note.midi === null) continue
    for (let j = i + 1; j < flat.length; j++) {
      const next = flat[j]
      if (next.tieStop && next.midi === note.midi) ends[i] += next.quarters
      else break
    }
  }
  return ends
}

export function extractTimedLyrics(xmlText: string): TimedLyricEntry[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parts: RawPart[] = Array.from(doc.getElementsByTagName('part')).map(parsePart)
  if (parts.length === 0) return []

  const timeline = buildTimeline(parts)
  const measureCount = Math.max(0, ...parts.map(part => part.measures.length))
  if (measureCount === 0) return []

  const forwardRepeat = new Array<boolean>(measureCount).fill(false)
  const backwardRepeat = new Array<boolean>(measureCount).fill(false)
  const backwardTimes = new Array<number>(measureCount).fill(2)
  const endingEvents: Array<Array<{ numbers: number[]; type: string }>> = Array.from({ length: measureCount }, () => [])

  for (const part of parts) {
    part.measures.forEach((measure, index) => {
      if (!measure) return
      if (measure.forwardRepeat) forwardRepeat[index] = true
      if (measure.backwardRepeat) {
        backwardRepeat[index] = true
        backwardTimes[index] = measure.backwardTimes
      }
      for (const ending of measure.endings) endingEvents[index].push(ending)
    })
  }

  // Resolve ending ranges: <ending type="start"> opens a volta, <ending
  // type="stop"> or "discontinue" closes it after that measure.
  const endingNumbers = new Array<number[]>(measureCount).fill([])
  let active: number[] | null = null
  for (let i = 0; i < measureCount; i++) {
    let closeAfter = false
    for (const event of endingEvents[i]) {
      if (event.type === 'start' && event.numbers.length) active = event.numbers
      else if (event.type === 'stop' || event.type === 'discontinue') closeAfter = true
    }
    endingNumbers[i] = active ?? []
    if (closeAfter) active = null
  }

  const meta: MeasureRepeatMeta[] = forwardRepeat.map((value, index) => ({
    forwardRepeat: value,
    backwardRepeat: backwardRepeat[index],
    backwardTimes: backwardTimes[index],
    endingNumbers: endingNumbers[index],
  }))
  const order = expandMeasureOrder(meta)

  const entries: TimedLyricEntry[] = []
  for (const part of parts) {
    const flat: ParsedNote[] = []
    const measureNoteStart: number[] = []
    for (const measure of part.measures) {
      measureNoteStart.push(flat.length)
      for (const item of measure.items) if (item.kind === 'note') flat.push(item.note)
    }
    const tieEnds = computeTieEnds(flat)

    let playheadSec = 0
    for (const measureIndex of order) {
      const measure = part.measures[measureIndex]
      if (!measure) continue
      const startQ = timeline.startQ[measureIndex] ?? 0
      const startSec = timeline.startSec[measureIndex] ?? 0
      let intra = 0
      let noteIndex = measureNoteStart[measureIndex] ?? 0
      for (const item of measure.items) {
        if (item.kind === 'note') {
          const note = item.note
          const noteStartQ = startQ + intra
          const noteStartSec = playheadSec + (timeline.timeAt(noteStartQ) - startSec)
          if (note.lyric) {
            const holdQuarters = tieEnds[noteIndex] ?? note.quarters
            const noteEndSec = noteStartSec + holdQuarters * (60 / timeline.bpmAt(noteStartQ))
            entries.push({ text: note.lyric, startUs: Math.round(noteStartSec * 1_000_000), endUs: Math.round(noteEndSec * 1_000_000) })
          }
          noteIndex++
          if (!note.grace && !note.chord) intra += note.quarters
        } else if (item.kind === 'backup') {
          intra -= item.quarters
        } else if (item.kind === 'forward') {
          intra += item.quarters
        }
      }
      playheadSec += timeline.durSec[measureIndex] ?? 0
    }
  }
  return entries.sort((a, b) => a.startUs - b.startUs)
}
