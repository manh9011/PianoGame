import { isBlackNote } from '../render/pianoLabels'
import type { FingeringAssignment, FingeringHandSummary, FingeringInputNote, FingeringOptions, FingeringResult, FingerNumber, HandSizeInfo, HandSizePreset } from './fingeringTypes'

const FINGERS: readonly FingerNumber[] = [1, 2, 3, 4, 5]
const DEFAULT_DEPTH = 9
const MIN_DEPTH = 3
const MAX_DEPTH = 9
const DEFAULT_CHORD_TOLERANCE_US = 35_000
const DEFAULT_CHORD_NOTE_STAGGER_S = 0.05
const KEYBOARD_OCTAVE_WIDTH_CM = 16.5
const SEMITONE_WIDTH_CM = KEYBOARD_OCTAVE_WIDTH_CM / 12
const HAND_SIZE_FACTORS: Record<HandSizePreset, number> = {
  XXS: 0.33,
  XS: 0.46,
  S: 0.64,
  M: 0.82,
  L: 1,
  XL: 1.1,
  XXL: 1.2,
}

interface InternalNote extends FingeringInputNote {
  x: number
  time: number
  duration: number
  pitch: number
  isBlack: boolean
  isChord: boolean
  chordId: number
  chordNumber: number
  notesInChord: number
  fingering: FingerNumber | 0
  cost: number
}

type FingerPositions = Array<number | null>

export function handSizeInfo(size: HandSizePreset): HandSizeInfo {
  const factor = HAND_SIZE_FACTORS[size]
  return { size, factor, relaxedThumbPinkySpanCm: 21 * factor }
}

export function normalizeHandSize(size?: string): HandSizePreset {
  return HAND_SIZE_FACTORS[size as HandSizePreset] ? size as HandSizePreset : 'M'
}

export function generatePianoFingering(notes: FingeringInputNote[], options: FingeringOptions = {}): FingeringResult {
  const handSize = normalizeHandSize(options.handSize)
  const selectedHand = options.hand ?? 'both'
  const windowedNotes = notes.filter(note => {
    if (selectedHand !== 'both' && note.hand !== selectedHand) return false
    if (note.hand !== 'left' && note.hand !== 'right') return false
    if (options.startUs !== undefined && note.end < options.startUs) return false
    if (options.endUs !== undefined && note.start > options.endUs) return false
    return true
  })
  const assignments: FingeringAssignment[] = []
  const summaries: FingeringHandSummary[] = []

  for (const hand of ['right', 'left'] as const) {
    if (selectedHand !== 'both' && selectedHand !== hand) continue
    const handNotes = windowedNotes
      .filter(note => note.hand === hand)
      .sort((a, b) => a.start - b.start || a.noteId - b.noteId || a.end - b.end)
    if (!handNotes.length) continue

    const internalNotes = toInternalNotes(handNotes, options.chordToleranceUs ?? DEFAULT_CHORD_TOLERANCE_US, options.chordNoteStaggerS ?? DEFAULT_CHORD_NOTE_STAGGER_S)
    const solver = new HandFingeringOptimizer(internalNotes, hand, handSize, options.depth)
    solver.generate()
    const handAssignments = internalNotes
      .filter(note => note.fingering >= 1 && note.fingering <= 5)
      .map(note => ({
        noteId: note.id,
        hand,
        finger: note.fingering as FingerNumber,
        source: note.fingerSource === 'manual' ? 'manual' as const : 'auto' as const,
        cost: note.cost,
      }))
    assignments.push(...handAssignments)
    const costs = handAssignments.map(item => item.cost).filter(cost => Number.isFinite(cost) && cost >= 0)
    summaries.push({
      hand,
      noteCount: internalNotes.length,
      assignmentCount: handAssignments.length,
      costMin: costs.length ? Math.min(...costs) : null,
      costMax: costs.length ? Math.max(...costs) : null,
    })
  }

  return { assignments, summaries, handSize }
}

function toInternalNotes(notes: FingeringInputNote[], chordToleranceUs: number, chordNoteStaggerS: number): InternalNote[] {
  const chordGroups = new Map<number, FingeringInputNote[]>()
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.noteId - b.noteId || a.end - b.end)
  let chordId = 0
  let chordStart = Number.NEGATIVE_INFINITY

  for (const note of sorted) {
    if (Math.abs(note.start - chordStart) > chordToleranceUs) {
      chordId += 1
      chordStart = note.start
    }
    const group = chordGroups.get(chordId) ?? []
    group.push(note)
    chordGroups.set(chordId, group)
  }

  const noteChordIds = new Map<string, number>()
  for (const [id, group] of chordGroups.entries()) {
    if (group.length <= 1) continue
    for (const note of group) noteChordIds.set(note.id, id)
  }

  const chordIndexes = new Map<number, number>()
  const chordSizes = new Map<number, number>()
  for (const [id, group] of chordGroups.entries()) chordSizes.set(id, group.length)

  return sorted.map(note => {
    const chord = noteChordIds.get(note.id) ?? 0
    const chordNumber = chord ? (chordIndexes.get(chord) ?? 0) + 1 : 0
    if (chord) chordIndexes.set(chord, chordNumber)
    const manualFinger = note.fingerSource === 'manual' && note.finger && note.finger >= 1 && note.finger <= 5 ? note.finger : 0
    const staggerS = chord ? (chordNumber - 1) * chordNoteStaggerS : 0
    return {
      ...note,
      pitch: note.noteId,
      x: keyPositionCm(note.noteId),
      time: note.start / 1_000_000 + staggerS,
      duration: Math.max(0.001, (note.end - note.start) / 1_000_000),
      isBlack: isBlackNote(note.noteId),
      isChord: chord > 0,
      chordId: chord,
      chordNumber,
      notesInChord: chord ? chordSizes.get(chord) ?? 1 : 1,
      fingering: manualFinger,
      cost: 0,
    }
  })
}

function keyPositionCm(noteId: number) {
  return noteId * SEMITONE_WIDTH_CM
}

class HandFingeringOptimizer {
  private readonly hand: 'left' | 'right'
  private readonly size: HandSizePreset
  private readonly handFactor: number
  private readonly restPositions: FingerPositions = [null, -7, -2.8, 0, 2.8, 5.6]
  private readonly weights: FingerPositions = [null, 1.1, 1, 1.1, 0.9, 0.8]
  private readonly blackKeyFactors: FingerPositions = [null, 0.3, 1, 1.1, 0.8, 0.7]
  private readonly maxSpanCm: number
  private readonly maxFollowLagCm: number
  private readonly minFingerGapCm: number
  private fingerPositions: FingerPositions
  private hasPositionState = false
  private depth = DEFAULT_DEPTH
  private readonly autoDepth: boolean
  private previousWindow: number[] = []

  preservePostureMemory = false
  relocationAlpha = 0.3

  constructor(private readonly notes: InternalNote[], hand: 'left' | 'right', size: HandSizePreset, depth?: number) {
    this.hand = hand
    this.size = size
    this.handFactor = HAND_SIZE_FACTORS[size]
    for (const finger of FINGERS) {
      const value = this.restPositions[finger]
      if (value) this.restPositions[finger] = value * this.handFactor
    }
    this.maxSpanCm = 21 * this.handFactor
    this.maxFollowLagCm = 2.5 * this.handFactor
    this.minFingerGapCm = 0.15 * this.handFactor
    this.fingerPositions = [...this.restPositions]
    this.autoDepth = !depth
    if (depth) this.depth = clampDepth(depth)
  }

  generate() {
    const originalX = this.hand === 'left' ? this.notes.map(note => note.x) : null
    if (this.hand === 'left') {
      for (const note of this.notes) note.x = -note.x
    }

    try {
      this.fingerPositions = [...this.restPositions]
      this.hasPositionState = false
      let startFinger = 0
      let velocity = 0
      const total = this.notes.length
      for (let index = 0; index < total; index += 1) {
        if (this.autoDepth && index > total - 11) this.depth = Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, total - index))
        const window = this.lookAheadWindow(index)
        const anchoredFinger = normalizeFinger(this.notes[index].fingering)
        if (anchoredFinger) {
          this.notes[index].fingering = anchoredFinger
          const solved = this.optimizeSeq(window, anchoredFinger)
          this.previousWindow = solved.fingering
          velocity = solved.cost
          startFinger = solved.fingering[1] ?? anchoredFinger
          this.setFingerPositions(solved.fingering, window, 0)
          this.notes[index].cost = velocity
          continue
        }

        let bestFinger: number
        if (index > total - 10 && this.previousWindow.length > 1) {
          bestFinger = this.previousWindow.splice(1, 1)[0]
          this.previousWindow[0] = bestFinger
          startFinger = this.previousWindow[1] ?? bestFinger
        } else {
          const solved = this.optimizeSeq(window, startFinger)
          this.previousWindow = solved.fingering
          velocity = solved.cost
          bestFinger = solved.fingering[0]
          startFinger = solved.fingering[1] ?? solved.fingering[0]
        }

        bestFinger = this.enforceChordGroupConsistency(index, bestFinger)
        this.previousWindow[0] = bestFinger
        this.notes[index].fingering = bestFinger as FingerNumber
        this.setFingerPositions(this.previousWindow, window, 0)
        this.notes[index].cost = velocity
      }
    } finally {
      if (originalX) {
        for (let index = 0; index < this.notes.length; index += 1) this.notes[index].x = originalX[index]
      }
    }
  }

  private lookAheadWindow(index: number) {
    const window = this.notes.slice(index, index + MAX_DEPTH)
    if (window.length && window.length < MAX_DEPTH) {
      const last = window[window.length - 1]
      while (window.length < MAX_DEPTH) window.push(last)
    }
    return window
  }

  private optimizeSeq(window: InternalNote[], startFinger: number): { fingering: number[]; cost: number } {
    if (this.autoDepth) {
      if (window[0].isChord) {
        this.depth = Math.max(MIN_DEPTH, window[0].notesInChord - window[0].chordNumber + 1)
      } else {
        const firstTime = window[0].time
        for (const nextDepth of [4, 5, 6, 7, 8, 9]) {
          this.depth = nextDepth
          if (window[nextDepth - 1].time - firstTime > 3.5) break
        }
      }
    }
    const depth = Math.max(MIN_DEPTH, Math.min(this.depth, window.length || MIN_DEPTH))
    const firstChoices = startFinger ? [startFinger] : [...FINGERS]
    let bestFingering = Array(MAX_DEPTH).fill(0)
    let minVelocity = 1e10
    const candidate = Array(MAX_DEPTH).fill(0)

    const backtrack = (level: number) => {
      if (level === depth) {
        const velocity = this.averageVelocity(candidate, window, depth)
        if (velocity < minVelocity) {
          bestFingering = [...candidate]
          minVelocity = velocity
        }
        return
      }
      const choices = level === 0 ? firstChoices : FINGERS
      for (const finger of choices) {
        if (level > 0 && this.skip(candidate[level - 1], finger, window[level - 1], window[level])) continue
        candidate[level] = finger
        backtrack(level + 1)
      }
    }

    backtrack(0)
    if (minVelocity >= 1e10) {
      const fallbackFinger = firstChoices[0] || 3
      bestFingering = Array(MAX_DEPTH).fill(fallbackFinger)
      minVelocity = this.averageVelocity(bestFingering, window, depth)
    }
    return { fingering: bestFingering, cost: minVelocity }
  }

  private averageVelocity(fingering: number[], notes: InternalNote[], depth: number) {
    let chordPenalty = 0
    const chordSeen = new Map<number, Array<{ pitch: number; finger: number }>>()
    for (let index = 0; index < depth; index += 1) {
      const note = notes[index]
      if (!note.isChord) continue
      const finger = fingering[index]
      if (!isFingerNumber(finger)) {
        chordPenalty += 1e6
        continue
      }
      const prior = chordSeen.get(note.chordId) ?? []
      for (const peer of prior) {
        if (finger === peer.finger && note.pitch !== peer.pitch) chordPenalty += 1e6
        if (this.hand === 'right') {
          if (note.pitch > peer.pitch && finger <= peer.finger) chordPenalty += 2e5
          else if (note.pitch < peer.pitch && finger >= peer.finger) chordPenalty += 2e5
        } else if (note.pitch > peer.pitch && finger >= peer.finger) chordPenalty += 2e5
        else if (note.pitch < peer.pitch && finger <= peer.finger) chordPenalty += 2e5
      }
      prior.push({ pitch: note.pitch, finger })
      chordSeen.set(note.chordId, prior)
    }

    const fingerPositions = [...this.fingerPositions]
    this.setFingerPositions(fingering, notes, 0, fingerPositions, false)
    let meanVelocity = 0
    for (let index = 1; index < depth; index += 1) {
      const from = notes[index - 1]
      const to = notes[index]
      const finger = fingering[index]
      const fingerPosition = fingerPositions[finger]
      if (fingerPosition === null || fingerPosition === undefined) continue
      const dx = Math.abs(to.x - fingerPosition)
      const dt = Math.abs(to.time - from.time) + 0.1
      let velocity = dx / dt
      const weight = this.weights[finger] || 1
      if (to.isBlack) velocity /= weight * (this.blackKeyFactors[finger] || 1)
      else velocity /= weight
      meanVelocity += velocity
      this.setFingerPositions(fingering, notes, index, fingerPositions, false)
    }
    return meanVelocity / Math.max(1, depth - 1) + chordPenalty
  }

  private setFingerPositions(fingering: number[], notes: InternalNote[], index: number, externalPositions?: FingerPositions, forceRelaxed = false) {
    const fingerPositions = externalPositions ?? this.fingerPositions
    const shouldForceRelaxed = externalPositions ? forceRelaxed : !this.hasPositionState
    const finger = fingering[index]
    const noteX = notes[index].x
    const targets = this.relaxedTargets(finger, noteX)
    if (!targets.size) return

    if (shouldForceRelaxed || !this.preservePostureMemory) {
      for (const other of FINGERS) fingerPositions[other] = targets.get(other) ?? null
      fingerPositions[finger] = noteX
      if (!externalPositions) this.hasPositionState = true
      return
    }

    for (const other of FINGERS) {
      const target = targets.get(other)
      if (target === undefined) {
        fingerPositions[other] = null
        continue
      }
      if (other === finger) {
        fingerPositions[other] = noteX
        continue
      }
      const previous = fingerPositions[other]
      fingerPositions[other] = previous === null || previous === undefined
        ? target
        : this.relocationAlpha * previous + (1 - this.relocationAlpha) * target
    }
    this.applyPositionConstraints(fingerPositions, finger, noteX, targets)
    if (!externalPositions) this.hasPositionState = true
  }

  private relaxedTargets(finger: number, noteX: number) {
    const activeRest = this.restPositions[finger]
    const targets = new Map<number, number>()
    if (activeRest === null || activeRest === undefined) return targets
    for (const other of FINGERS) {
      const rest = this.restPositions[other]
      if (rest === null || rest === undefined) continue
      targets.set(other, rest - activeRest + noteX)
    }
    return targets
  }

  private applyPositionConstraints(fingerPositions: FingerPositions, finger: number, noteX: number, targets: Map<number, number>) {
    for (const other of FINGERS) {
      if (other === finger) continue
      const position = fingerPositions[other]
      const target = targets.get(other)
      if (position === null || position === undefined || target === undefined) continue
      const lag = position - target
      if (lag > this.maxFollowLagCm) fingerPositions[other] = target + this.maxFollowLagCm
      else if (lag < -this.maxFollowLagCm) fingerPositions[other] = target - this.maxFollowLagCm
    }

    for (let other = 2; other <= 5; other += 1) {
      const previous = fingerPositions[other - 1]
      const current = fingerPositions[other]
      if (previous === null || previous === undefined || current === null || current === undefined) continue
      const minAllowed = previous + this.minFingerGapCm
      if (current < minAllowed) fingerPositions[other] = minAllowed
    }

    if (fingerPositions[1] !== null && fingerPositions[1] !== undefined && fingerPositions[5] !== null && fingerPositions[5] !== undefined) {
      const span = fingerPositions[5] - fingerPositions[1]
      if (span > this.maxSpanCm) {
        const limit = this.maxSpanCm / 2
        for (const other of FINGERS) {
          if (other === finger || fingerPositions[other] === null || fingerPositions[other] === undefined) continue
          const offset = (fingerPositions[other] ?? 0) - noteX
          if (offset > limit) fingerPositions[other] = noteX + limit
          else if (offset < -limit) fingerPositions[other] = noteX - limit
        }
      }
    }
    fingerPositions[finger] = noteX
  }

  private skip(fromFinger: number, toFinger: number, from: InternalNote, to: InternalNote) {
    const xDistance = to.x - from.x
    if (!from.isChord && !to.isChord) {
      if (fromFinger === toFinger && xDistance && from.duration < 4) return true
      if (fromFinger > 1) {
        if (toFinger > 1 && (toFinger - fromFinger) * xDistance < 0) return true
        if (toFinger === 1 && to.isBlack && xDistance > 0) return true
      } else if (from.isBlack && xDistance < 0 && toFinger > 1 && from.duration < 2) {
        return true
      }
    } else if (from.isChord && to.isChord && from.chordId === to.chordId) {
      const scaledDistance = Math.abs(xDistance) * this.handFactor / 0.8
      if (fromFinger === toFinger) return true
      if (fromFinger < toFinger && this.hand === 'left') return true
      if (fromFinger > toFinger && this.hand === 'right') return true
      const threshold = chordStretchThreshold(fromFinger, toFinger)
      if (threshold !== null && scaledDistance > threshold) return true
    }
    return false
  }

  private enforceChordGroupConsistency(index: number, finger: number) {
    if (!isFingerNumber(finger)) return finger
    const note = this.notes[index]
    if (!note.isChord) return finger
    const peers: Array<{ pitch: number; finger: number }> = []
    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = this.notes[previousIndex]
      if (!previous.isChord || previous.chordId !== note.chordId || !isFingerNumber(previous.fingering)) continue
      peers.push({ pitch: previous.pitch, finger: previous.fingering })
    }
    if (!peers.length) return finger
    const used = new Set(peers.map(peer => peer.finger))
    const candidates = FINGERS.filter(item => !used.has(item))
    const pool = candidates.length ? candidates : [finger as FingerNumber]
    return pool
      .map(candidate => {
        let penalty = 0
        for (const peer of peers) {
          if (this.hand === 'right') {
            if (note.pitch > peer.pitch && candidate <= peer.finger) penalty += 100 + (peer.finger - candidate)
            else if (note.pitch < peer.pitch && candidate >= peer.finger) penalty += 100 + (candidate - peer.finger)
          } else if (note.pitch > peer.pitch && candidate >= peer.finger) penalty += 100 + (candidate - peer.finger)
          else if (note.pitch < peer.pitch && candidate <= peer.finger) penalty += 100 + (peer.finger - candidate)
        }
        return { candidate, penalty, distance: Math.abs(candidate - finger) }
      })
      .sort((a, b) => a.penalty - b.penalty || a.distance - b.distance || a.candidate - b.candidate)[0].candidate
  }
}

function chordStretchThreshold(a: number, b: number) {
  const pair = `${Math.min(a, b)}:${Math.max(a, b)}`
  const thresholds: Record<string, number> = {
    '3:4': 5,
    '4:5': 5,
    '2:3': 6,
    '2:4': 7,
    '3:5': 8,
    '2:5': 11,
    '1:2': 12,
    '1:3': 14,
    '1:4': 16,
  }
  return thresholds[pair] ?? null
}

function normalizeFinger(value: unknown): FingerNumber | 0 {
  const finger = Number(value)
  return isFingerNumber(finger) ? finger : 0
}

function isFingerNumber(value: unknown): value is FingerNumber {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

function clampDepth(depth: number) {
  return Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, Math.round(depth)))
}
