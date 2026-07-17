export type TimingJudgement = 'barely' | 'ok' | 'good' | 'great' | 'perfect'
export type ErrorEventType = 'stray' | 'wrong'
export type NoteOutcomeStatus = 'hit' | 'missed'

export interface ComboTier {
  combo: number
  label: string
  factor: number
}

export interface TimingJudgementWindows {
  perfectUs: number
  greatUs: number
  goodUs: number
  okUs: number
  barelyUs: number
}

export interface ScoringConfig {
  holdTickUs: number
  pointScale: number
  maxComboFactor: number
  comboTiers: ComboTier[]
  timing: TimingJudgementWindows
  timingFactors: Record<TimingJudgement, number>
}

export interface NoteOutcome {
  noteId: string
  noteStartUs: number
  noteEndUs: number
  status: NoteOutcomeStatus
  hitAtUs?: number
  timingOffsetUs?: number
  judgement?: TimingJudgement
  holdTicksAwarded: number
  rawPointsAwarded: number
}

export interface ActiveHold {
  sessionNoteId: string
  inputNoteId: number
  noteStartUs: number
  noteEndUs: number
  awardStartUs: number
  lastAwardedTickIndex: number
  comboFactor: number
  timingFactor: number
}

export interface TimedErrorEvent {
  id: string
  atUs: number
  type: ErrorEventType
}

export interface PlayedSegment {
  startUs: number
  endUs: number
}

export interface SpeedSegment extends PlayedSegment {
  realUs: number
}

export interface SpeedTrackingState {
  playedSongUs: number
  playedRealUs: number
  segments: SpeedSegment[]
  lastTickUs?: number
  lastTickMs?: number
}

export interface GameplayFeedbackState {
  combo: number
  judgement?: TimingJudgement
  visibleUntilMs: number
  sequence: number
}

export interface ScoreState {
  score: number
  rawPoints: number
  combo: number
  longestCombo: number
  notesUserCouldHavePlayed: number
  notesUserActuallyPlayed: number
  speedIntegral: number
  strayNotes: number
  missedNotes: number
  wrongNotes: number
  noteOutcomes: Record<string, NoteOutcome>
  errorEvents: TimedErrorEvent[]
  activeHolds: Record<string, ActiveHold>
  playedSegments: PlayedSegment[]
  speedTracking: SpeedTrackingState
  judgementCounts: Record<TimingJudgement, number>
  feedback: GameplayFeedbackState | null
}

const COMBO_TIERS: ComboTier[] = Array.from({ length: 16 }, (_, index) => {
  const combo = index + 1
  return { combo, label: `x${combo}`, factor: Math.min(2.5, 1 + index * 0.1) }
})

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  holdTickUs: 100_000,
  pointScale: 100,
  maxComboFactor: 2.5,
  comboTiers: COMBO_TIERS,
  timing: {
    perfectUs: 50_000,
    greatUs: 100_000,
    goodUs: 180_000,
    okUs: 250_000,
    barelyUs: 330_000,
  },
  timingFactors: {
    barely: 0.8,
    ok: 0.85,
    good: 0.9,
    great: 0.95,
    perfect: 1,
  },
}

export function createScoreState(): ScoreState {
  return {
    score: 0,
    rawPoints: 0,
    combo: 0,
    longestCombo: 0,
    notesUserCouldHavePlayed: 0,
    notesUserActuallyPlayed: 0,
    speedIntegral: 0,
    strayNotes: 0,
    missedNotes: 0,
    wrongNotes: 0,
    noteOutcomes: {},
    errorEvents: [],
    activeHolds: {},
    playedSegments: [],
    speedTracking: { playedSongUs: 0, playedRealUs: 0, segments: [] },
    judgementCounts: { barely: 0, ok: 0, good: 0, great: 0, perfect: 0 },
    feedback: null,
  }
}

export function displayPoints(rawPoints: number) {
  return Math.round(rawPoints)
}

export function resolveComboBonus(combo: number, config = DEFAULT_SCORING_CONFIG) {
  const normalized = Math.max(1, Math.floor(combo || 1))
  let tier: ComboTier | undefined
  for (const item of config.comboTiers) {
    if (normalized >= item.combo && (!tier || item.combo > tier.combo)) tier = item
  }
  if (!tier) return { label: 'x1', factor: 1 }
  return { label: tier.label, factor: Math.min(config.maxComboFactor, tier.factor) }
}

export function classifyTiming(offsetUs: number, config = DEFAULT_SCORING_CONFIG): TimingJudgement {
  const offset = Math.abs(offsetUs)
  if (offset <= config.timing.perfectUs) return 'perfect'
  if (offset <= config.timing.greatUs) return 'great'
  if (offset <= config.timing.goodUs) return 'good'
  if (offset <= config.timing.okUs) return 'ok'
  return 'barely'
}

export function judgementLabel(judgement?: TimingJudgement) {
  if (judgement === 'perfect') return 'Perfect!'
  if (judgement === 'great') return 'Great!'
  if (judgement === 'good') return 'Good!'
  if (judgement === 'ok') return 'OK!'
  if (judgement === 'barely') return 'Barely!'
  return ''
}

export function effectiveSpeedFactor(s: ScoreState) {
  const baseFactor = s.speedTracking.playedRealUs > 0 ? s.speedTracking.playedSongUs / s.speedTracking.playedRealUs : 1
  const totalErrors = s.strayNotes + s.wrongNotes + s.missedNotes
  const errorPenalty = Math.max(0.25, 1 - totalErrors * 0.03)
  return baseFactor * errorPenalty
}

function refreshSpeedIntegral(s: ScoreState) {
  s.speedIntegral = Math.round(effectiveSpeedFactor(s) * 100) * s.notesUserCouldHavePlayed
}

function applyHitTotals(s: ScoreState, judgement: TimingJudgement) {
  s.combo += 1
  s.longestCombo = Math.max(s.longestCombo, s.combo)
  s.notesUserCouldHavePlayed += 1
  s.notesUserActuallyPlayed += 1
  s.judgementCounts[judgement] += 1
  refreshSpeedIntegral(s)
}

function applyMissTotals(s: ScoreState) {
  s.combo = 0
  s.notesUserCouldHavePlayed += 1
  s.missedNotes += 1
  refreshSpeedIntegral(s)
}

function applyErrorTotals(s: ScoreState, type: ErrorEventType) {
  s.combo = 0
  if (type === 'stray') s.strayNotes += 1
  else s.wrongNotes += 1
  refreshSpeedIntegral(s)
}

export function recordHit(s: ScoreState, note: { id: string; start: number; end: number }, hitAtUs: number, inputNoteId: number, nowMs: number, config = DEFAULT_SCORING_CONFIG) {
  if (s.noteOutcomes[note.id]) return
  const timingOffsetUs = hitAtUs - note.start
  const judgement = classifyTiming(timingOffsetUs, config)
  const nextCombo = s.combo + 1
  const comboBonus = resolveComboBonus(nextCombo, config)

  s.noteOutcomes[note.id] = {
    noteId: note.id,
    noteStartUs: note.start,
    noteEndUs: note.end,
    status: 'hit',
    hitAtUs,
    timingOffsetUs,
    judgement,
    holdTicksAwarded: 0,
    rawPointsAwarded: 0,
  }
  s.activeHolds[note.id] = {
    sessionNoteId: note.id,
    inputNoteId,
    noteStartUs: note.start,
    noteEndUs: note.end,
    awardStartUs: Math.max(note.start, hitAtUs),
    lastAwardedTickIndex: 0,
    comboFactor: comboBonus.factor,
    timingFactor: config.timingFactors[judgement],
  }
  applyHitTotals(s, judgement)
  s.feedback = { combo: s.combo, judgement, visibleUntilMs: nowMs + 850, sequence: (s.feedback?.sequence ?? 0) + 1 }
}

export function recordMiss(s: ScoreState, note: { id: string; start: number; end: number }) {
  recordMisses(s, [note])
}

export function recordMisses(s: ScoreState, notes: Array<{ id: string; start: number; end: number }>) {
  for (const note of notes) {
    if (s.noteOutcomes[note.id]) continue
    s.noteOutcomes[note.id] = {
      noteId: note.id,
      noteStartUs: note.start,
      noteEndUs: note.end,
      status: 'missed',
      holdTicksAwarded: 0,
      rawPointsAwarded: 0,
    }
    delete s.activeHolds[note.id]
    applyMissTotals(s)
  }
}

export function recordStray(s: ScoreState, atUs: number) {
  s.errorEvents.push({ id: `stray:${atUs}:${s.errorEvents.length}`, atUs, type: 'stray' })
  applyErrorTotals(s, 'stray')
}

export function recordWrong(s: ScoreState, atUs: number) {
  s.errorEvents.push({ id: `wrong:${atUs}:${s.errorEvents.length}`, atUs, type: 'wrong' })
  applyErrorTotals(s, 'wrong')
}

export function awardHoldPoints(s: ScoreState, currentUs: number, mode: 'noteMemory' | 'practice' | 'performance' | 'listen', config = DEFAULT_SCORING_CONFIG) {
  if (mode === 'listen') return
  const speedFactor = mode === 'performance' ? 1 : effectiveSpeedFactor(s)
  for (const [key, hold] of Object.entries(s.activeHolds)) {
    const eligibleUntilUs = Math.min(currentUs, hold.noteEndUs)
    const elapsedUs = eligibleUntilUs - hold.awardStartUs
    const tickIndex = Math.max(0, Math.floor(elapsedUs / config.holdTickUs))
    const ticksToAward = tickIndex - hold.lastAwardedTickIndex
    if (ticksToAward > 0) {
      const points = ticksToAward * config.pointScale * speedFactor * hold.timingFactor * hold.comboFactor
      hold.lastAwardedTickIndex = tickIndex
      const outcome = s.noteOutcomes[hold.sessionNoteId]
      if (outcome) {
        outcome.holdTicksAwarded += ticksToAward
        outcome.rawPointsAwarded += points
      }
      s.rawPoints += points
      s.score = displayPoints(s.rawPoints)
    }
    if (currentUs >= hold.noteEndUs) delete s.activeHolds[key]
  }
}

export function stopHoldsForInput(s: ScoreState, inputNoteId: number) {
  for (const [key, hold] of Object.entries(s.activeHolds)) {
    if (hold.inputNoteId === inputNoteId) delete s.activeHolds[key]
  }
}

export function updateSpeedTracking(s: ScoreState, currentUs: number, nowMs: number) {
  const tracking = s.speedTracking
  if (tracking.lastTickUs !== undefined && tracking.lastTickMs !== undefined) {
    const rawStartUs = tracking.lastTickUs
    const rawEndUs = currentUs
    const realUs = Math.max(0, (nowMs - tracking.lastTickMs) * 1000)
    if (rawEndUs > rawStartUs && realUs > 0) {
      const startUs = Math.max(0, rawStartUs)
      const endUs = Math.max(0, rawEndUs)
      if (endUs > startUs) {
        const songUs = endUs - startUs
        appendSpeedSegment(tracking.segments, startUs, endUs, realUs)
        tracking.playedSongUs += songUs
        tracking.playedRealUs += realUs
        appendPlayedSegment(s.playedSegments, startUs, endUs)
      }
    }
  }
  tracking.lastTickUs = currentUs
  tracking.lastTickMs = nowMs
}

export function resetSpeedTrackingAnchor(s: ScoreState, currentUs: number, nowMs: number) {
  s.speedTracking.lastTickUs = currentUs
  s.speedTracking.lastTickMs = nowMs
}

export function appendSpeedSegment(segments: SpeedSegment[], startUs: number, endUs: number, realUs: number) {
  const start = Math.max(0, Math.min(startUs, endUs))
  const end = Math.max(0, Math.max(startUs, endUs))
  if (end <= start || realUs <= 0) return

  const mergeGapUs = 10_000
  const last = segments[segments.length - 1]
  if (last && start >= last.startUs && start <= last.endUs + mergeGapUs) {
    last.endUs = Math.max(last.endUs, end)
    last.realUs += realUs
    return
  }

  segments.push({ startUs: start, endUs: end, realUs })
}

export function appendPlayedSegment(segments: PlayedSegment[], startUs: number, endUs: number) {
  const start = Math.max(0, Math.min(startUs, endUs))
  const end = Math.max(0, Math.max(startUs, endUs))
  if (end <= start) return

  const mergeGapUs = 10_000
  const last = segments[segments.length - 1]
  if (!last) {
    segments.push({ startUs: start, endUs: end })
    return
  }

  if (start >= last.startUs) {
    if (start <= last.endUs + mergeGapUs) {
      last.endUs = Math.max(last.endUs, end)
      return
    }
    segments.push({ startUs: start, endUs: end })
    return
  }

  const merged = [...segments, { startUs: start, endUs: end }]
    .sort((a, b) => a.startUs - b.startUs)
    .reduce<PlayedSegment[]>((acc, segment) => {
      const previous = acc[acc.length - 1]
      if (!previous || segment.startUs > previous.endUs + mergeGapUs) {
        acc.push({ ...segment })
        return acc
      }
      previous.endUs = Math.max(previous.endUs, segment.endUs)
      return acc
    }, [])

  segments.splice(0, segments.length, ...merged)
}

export function trimPlayedSegmentsAfter(segments: PlayedSegment[], seekUs: number) {
  const endUs = Math.max(0, seekUs)
  return segments.flatMap(segment => {
    if (segment.startUs >= endUs) return []
    if (segment.endUs <= endUs) return [segment]
    return [{ startUs: segment.startUs, endUs }]
  })
}

export function trimScoreAfter(s: ScoreState, seekUs: number) {
  for (const [id, outcome] of Object.entries(s.noteOutcomes)) {
    if (outcome.noteStartUs >= seekUs && outcome.status === 'hit') delete s.noteOutcomes[id]
  }
  s.errorEvents = s.errorEvents.filter(event => event.atUs < seekUs)
  s.activeHolds = {}
  s.feedback = null
  s.playedSegments = trimPlayedSegmentsAfter(s.playedSegments, seekUs)

  s.speedTracking.segments = s.speedTracking.segments.flatMap(segment => {
    if (segment.startUs >= seekUs) return []
    if (segment.endUs <= seekUs) return [segment]
    const keptSongUs = seekUs - segment.startUs
    const originalSongUs = segment.endUs - segment.startUs
    const ratio = originalSongUs > 0 ? keptSongUs / originalSongUs : 0
    return [{ startUs: segment.startUs, endUs: seekUs, realUs: segment.realUs * ratio }]
  })
  s.speedTracking.playedSongUs = s.speedTracking.segments.reduce((sum, segment) => sum + Math.max(0, segment.endUs - segment.startUs), 0)
  s.speedTracking.playedRealUs = s.speedTracking.segments.reduce((sum, segment) => sum + segment.realUs, 0)
  s.speedTracking.lastTickUs = undefined
  s.speedTracking.lastTickMs = undefined

  recalculateScoreTotals(s)
}

export function recalculateScoreTotals(s: ScoreState) {
  const events: Array<{ atUs: number; kind: 'hit' | 'missed' | ErrorEventType }> = []
  let rawPoints = 0
  let hitCount = 0
  let missedCount = 0
  const judgementCounts: Record<TimingJudgement, number> = { barely: 0, ok: 0, good: 0, great: 0, perfect: 0 }

  for (const outcome of Object.values(s.noteOutcomes)) {
    rawPoints += outcome.rawPointsAwarded
    events.push({ atUs: outcome.noteStartUs, kind: outcome.status })
    if (outcome.status === 'hit') hitCount += 1
    else missedCount += 1
    if (outcome.judgement) judgementCounts[outcome.judgement]++
  }

  let strayCount = 0
  let wrongCount = 0
  for (const event of s.errorEvents) {
    if (event.type === 'stray') strayCount += 1
    else wrongCount += 1
    events.push({ atUs: event.atUs, kind: event.type })
  }

  s.rawPoints = rawPoints
  s.score = displayPoints(rawPoints)
  s.notesUserActuallyPlayed = hitCount
  s.notesUserCouldHavePlayed = hitCount + missedCount
  s.missedNotes = missedCount
  s.strayNotes = strayCount
  s.wrongNotes = wrongCount
  s.speedIntegral = Math.round(effectiveSpeedFactor(s) * 100) * s.notesUserCouldHavePlayed
  s.judgementCounts = judgementCounts

  events.sort((a, b) => a.atUs - b.atUs)

  let combo = 0
  let longestCombo = 0
  for (const event of events) {
    if (event.kind === 'hit') {
      combo++
      longestCombo = Math.max(longestCombo, combo)
    } else {
      combo = 0
    }
  }
  s.combo = combo
  s.longestCombo = longestCombo
}

export function scoreHit(s: ScoreState, speed: number) {
  const comboBonus = resolveComboBonus(s.combo + 1)
  s.rawPoints += 100 * comboBonus.factor * (speed / 100)
  s.score = displayPoints(s.rawPoints)
  s.combo++
  s.longestCombo = Math.max(s.longestCombo, s.combo)
  s.notesUserCouldHavePlayed++
  s.notesUserActuallyPlayed++
  s.speedIntegral += speed
}

export function scoreMiss(s: ScoreState, speed: number) {
  s.combo = 0
  s.notesUserCouldHavePlayed++
  s.speedIntegral += speed
  s.missedNotes++
}

export function scoreStray(s: ScoreState) {
  recordStray(s, 0)
}

export function scoreWrong(s: ScoreState) {
  recordWrong(s, 0)
}

export function grade(s: ScoreState) {
  const p = accuracy(s)
  if (p >= 0.95) return 'A'
  if (p >= 0.85) return 'B'
  if (p >= 0.70) return 'C'
  if (p >= 0.50) return 'D'
  return 'F'
}

export function accuracy(s: ScoreState) {
  return s.notesUserCouldHavePlayed ? s.notesUserActuallyPlayed / s.notesUserCouldHavePlayed : 0
}

export function averageSpeed(s: ScoreState) {
  if (s.speedTracking.playedRealUs > 0) return Math.round(effectiveSpeedFactor(s) * 100)
  return s.notesUserCouldHavePlayed ? Math.round(s.speedIntegral / s.notesUserCouldHavePlayed) : 0
}

export function isPerfect(s: ScoreState) {
  return s.notesUserCouldHavePlayed > 0 && s.notesUserActuallyPlayed === s.notesUserCouldHavePlayed && s.strayNotes === 0 && s.missedNotes === 0 && s.wrongNotes === 0
}
