import { Midi } from '@tonejs/midi'

export type Hand = 'left' | 'right'

export interface DifficultyOptions {
  leftTrackIndex: number
  rightTrackIndex: number
  comfortableSpanSemitones?: Partial<Record<Hand, number>>
  analysisWindowSeconds?: number
  hopSeconds?: number
  chordToleranceSeconds?: number
  handAlignmentToleranceSeconds?: number
  maxHardSegments?: number
}

export interface FeatureScore {
  value: number
  normalized: number
  weight: number
  contribution: number
}

export interface HandMetrics {
  noteRateP90: number
  attackRateP90: number
  chordRateP90: number
  chordSizeP95: number
  chordSpanP90: number
  movementDemandP90: number
  fastLeapRatio: number
  repetitionRateP90: number
  alternationRateP90: number
  maxPhysicalPolyphony: number
  rhythmComplexity: number
  sustainedActivity: number
}

export interface HandDifficulty {
  score: number
  normalized: number
  noteCount: number
  attackCount: number
  metrics: HandMetrics
  features: Record<string, FeatureScore>
}

export interface CoordinationDifficulty {
  score: number
  normalized: number
  simultaneousDemand: number
  rhythmicIndependence: number
  crossingRatio: number
  bothHandsBusy: number
}

export interface HardSegment {
  startSeconds: number
  endSeconds: number
  score: number
  leftHandScore: number
  rightHandScore: number
  coordinationScore: number
}

export interface MidiDifficultyResult {
  score: number
  roundedScore: number
  label: string
  leftHand: HandDifficulty
  rightHand: HandDifficulty
  coordination: CoordinationDifficulty
  hardSegments: HardSegment[]
  reasons: string[]
  warnings: string[]
  metadata: {
    durationSeconds: number
    ppq: number
    leftTrackIndex: number
    rightTrackIndex: number
    leftTrackName: string
    rightTrackName: string
  }
}

interface InternalNote {
  midi: number
  time: number
  duration: number
  ticks: number
}

interface AttackGroup {
  time: number
  ticks: number
  notes: InternalNote[]
  size: number
  minPitch: number
  maxPitch: number
  centerPitch: number
  span: number
}

interface HandAnalysisContext {
  hand: Hand
  ppq: number
  comfortableSpan: number
  chordToleranceSeconds: number
  regionStart: number
  regionEnd: number
}

interface DifficultyConfig {
  comfortableSpan: Record<Hand, number>
  analysisWindowSeconds: number
  hopSeconds: number
  chordToleranceSeconds: number
  alignmentToleranceSeconds: number
  maxHardSegments: number
}

interface HandTrackNotes {
  leftNotes: InternalNote[]
  rightNotes: InternalNote[]
  leftTrackIndex: number
  rightTrackIndex: number
  leftTrackName: string
  rightTrackName: string
}

const EPSILON = 1e-9
const DEFAULT_HAND_SPLIT_NOTE_ID = 60

const DEFAULTS = {
  comfortableSpanSemitones: { left: 12, right: 12 } satisfies Record<Hand, number>,
  analysisWindowSeconds: 2,
  hopSeconds: 0.5,
  chordToleranceSeconds: 0.035,
  handAlignmentToleranceSeconds: 0.045,
  maxHardSegments: 5,
}

export function evaluateMidiDifficulty(
  input: ArrayBuffer | Uint8Array,
  options: DifficultyOptions,
): MidiDifficultyResult {
  validateOptions(options)

  const midi = new Midi(toMidiBytes(input))
  const leftTrack = midi.tracks[options.leftTrackIndex]
  const rightTrack = midi.tracks[options.rightTrackIndex]

  if (!leftTrack || !rightTrack) {
    throw new RangeError(
      `Track index không hợp lệ. MIDI có ${midi.tracks.length} track, nhưng nhận left=${options.leftTrackIndex}, right=${options.rightTrackIndex}.`,
    )
  }

  const ppq = midi.header.ppq
  validatePpq(ppq)

  return evaluateHandNotes(
    toInternalNotes(leftTrack.notes),
    toInternalNotes(rightTrack.notes),
    ppq,
    Math.max(midi.duration, lastNoteEnd(toInternalNotes(leftTrack.notes)), lastNoteEnd(toInternalNotes(rightTrack.notes))),
    resolveConfig(options),
    {
      leftTrackIndex: options.leftTrackIndex,
      rightTrackIndex: options.rightTrackIndex,
      leftTrackName: leftTrack.name || `Track ${options.leftTrackIndex}`,
      rightTrackName: rightTrack.name || `Track ${options.rightTrackIndex}`,
    },
  )
}

export function evaluateMidiDifficultyAuto(
  input: ArrayBuffer | Uint8Array,
  options: Omit<DifficultyOptions, 'leftTrackIndex' | 'rightTrackIndex'> = {},
): MidiDifficultyResult {
  const midi = new Midi(toMidiBytes(input))
  const ppq = midi.header.ppq
  validatePpq(ppq)

  const handTracks = inferHandTrackNotes(midi)
  const durationSeconds = Math.max(
    midi.duration,
    lastNoteEnd(handTracks.leftNotes),
    lastNoteEnd(handTracks.rightNotes),
  )

  return evaluateHandNotes(
    handTracks.leftNotes,
    handTracks.rightNotes,
    ppq,
    durationSeconds,
    resolveConfig(options),
    {
      leftTrackIndex: handTracks.leftTrackIndex,
      rightTrackIndex: handTracks.rightTrackIndex,
      leftTrackName: handTracks.leftTrackName,
      rightTrackName: handTracks.rightTrackName,
    },
  )
}

function inferHandTrackNotes(midi: Midi): HandTrackNotes {
  const candidates = midi.tracks
    .map((track, index) => {
      const notes = toInternalNotes(track.notes)
      return {
        index,
        name: track.name || `Track ${index}`,
        notes,
        noteCount: notes.length,
        medianPitch: median(notes.map(note => note.midi)),
        isPercussion: track.instrument?.percussion ?? track.channel === 9,
      }
    })
    .filter(track => track.noteCount > 0)

  const melodicTracks = candidates.filter(track => !track.isPercussion)
  const usableTracks = melodicTracks.length ? melodicTracks : candidates

  if (usableTracks.length >= 2) {
    const [first, second] = [...usableTracks]
      .sort((a, b) => b.noteCount - a.noteCount)
      .slice(0, 2)
      .sort((a, b) => a.medianPitch - b.medianPitch)
    return {
      leftNotes: first.notes,
      rightNotes: second.notes,
      leftTrackIndex: first.index,
      rightTrackIndex: second.index,
      leftTrackName: first.name,
      rightTrackName: second.name,
    }
  }

  const single = usableTracks[0]
  if (!single) throw new Error('MIDI không có track chứa note để đánh giá độ khó.')

  const leftNotes = single.notes.filter(note => note.midi < DEFAULT_HAND_SPLIT_NOTE_ID)
  const rightNotes = single.notes.filter(note => note.midi >= DEFAULT_HAND_SPLIT_NOTE_ID)
  if (!leftNotes.length && !rightNotes.length) throw new Error('Track không có note hợp lệ để đánh giá độ khó.')

  return {
    leftNotes,
    rightNotes,
    leftTrackIndex: single.index,
    rightTrackIndex: single.index,
    leftTrackName: `${single.name} < C4`,
    rightTrackName: `${single.name} ≥ C4`,
  }
}

function evaluateHandNotes(
  leftNotes: InternalNote[],
  rightNotes: InternalNote[],
  ppq: number,
  durationSeconds: number,
  config: DifficultyConfig,
  metadata: Pick<MidiDifficultyResult['metadata'], 'leftTrackIndex' | 'rightTrackIndex' | 'leftTrackName' | 'rightTrackName'>,
): MidiDifficultyResult {
  if (leftNotes.length === 0 && rightNotes.length === 0) {
    throw new Error('Hai track tay không có note nào.')
  }

  const leftHand = analyzeHand(leftNotes, {
    hand: 'left',
    ppq,
    comfortableSpan: config.comfortableSpan.left,
    chordToleranceSeconds: config.chordToleranceSeconds,
    regionStart: 0,
    regionEnd: durationSeconds,
  })

  const rightHand = analyzeHand(rightNotes, {
    hand: 'right',
    ppq,
    comfortableSpan: config.comfortableSpan.right,
    chordToleranceSeconds: config.chordToleranceSeconds,
    regionStart: 0,
    regionEnd: durationSeconds,
  })

  const leftGroups = groupAttacks(leftNotes, config.chordToleranceSeconds)
  const rightGroups = groupAttacks(rightNotes, config.chordToleranceSeconds)

  const coordination = analyzeCoordination(
    leftGroups,
    rightGroups,
    leftHand.normalized,
    rightHand.normalized,
    config.alignmentToleranceSeconds,
    0,
    durationSeconds,
  )

  const segmentAnalyses = analyzeSegments(leftNotes, rightNotes, durationSeconds, ppq, config)
  const localScores = segmentAnalyses.map(segment => scoreToNormalized(segment.score))
  const technicalCeiling = localScores.length > 0
    ? 0.7 * percentile(localScores, 0.95) + 0.3 * Math.max(...localScores)
    : 0
  const typicalDemand = percentile(localScores, 0.6)

  const handGlobal =
    0.65 * Math.max(leftHand.normalized, rightHand.normalized) +
    0.35 * mean([leftHand.normalized, rightHand.normalized])

  const rawDifficulty = clamp01(
    0.5 * technicalCeiling +
      0.23 * typicalDemand +
      0.17 * handGlobal +
      0.1 * coordination.normalized,
  )

  const score = roundTo(1 + 9 * Math.pow(rawDifficulty, 0.9), 2)
  const roundedScore = clamp(Math.round(score), 1, 10)
  const warnings = buildWarnings(leftNotes, rightNotes, leftHand, rightHand, durationSeconds)

  return {
    score,
    roundedScore,
    label: difficultyLabel(roundedScore),
    leftHand,
    rightHand,
    coordination,
    hardSegments: selectHardSegments(segmentAnalyses, config.maxHardSegments, config.analysisWindowSeconds),
    reasons: buildReasons(leftHand, rightHand, coordination),
    warnings,
    metadata: {
      durationSeconds: roundTo(durationSeconds, 3),
      ppq,
      ...metadata,
    },
  }
}

function resolveConfig(options: Omit<DifficultyOptions, 'leftTrackIndex' | 'rightTrackIndex'>): DifficultyConfig {
  return {
    comfortableSpan: {
      left: options.comfortableSpanSemitones?.left ?? DEFAULTS.comfortableSpanSemitones.left,
      right: options.comfortableSpanSemitones?.right ?? DEFAULTS.comfortableSpanSemitones.right,
    },
    analysisWindowSeconds: options.analysisWindowSeconds ?? DEFAULTS.analysisWindowSeconds,
    hopSeconds: options.hopSeconds ?? DEFAULTS.hopSeconds,
    chordToleranceSeconds: options.chordToleranceSeconds ?? DEFAULTS.chordToleranceSeconds,
    alignmentToleranceSeconds: options.handAlignmentToleranceSeconds ?? DEFAULTS.handAlignmentToleranceSeconds,
    maxHardSegments: options.maxHardSegments ?? DEFAULTS.maxHardSegments,
  }
}

function analyzeHand(notesInput: InternalNote[], context: HandAnalysisContext): HandDifficulty {
  const notes = notesInput
    .filter(note => note.time >= context.regionStart - EPSILON && note.time < context.regionEnd - EPSILON)
    .sort((a, b) => a.time - b.time || a.midi - b.midi)

  if (notes.length === 0) return emptyHandDifficulty()

  const groups = groupAttacks(notes, context.chordToleranceSeconds)
  const regionDuration = Math.max(0.25, context.regionEnd - context.regionStart)

  const noteRates = rollingRates(notes.map(note => note.time), Math.min(1, regionDuration), context.regionStart, context.regionEnd)
  const attackRates = rollingRates(groups.map(group => group.time), Math.min(1, regionDuration), context.regionStart, context.regionEnd)
  const chordGroups = groups.filter(group => group.size >= 2)
  const chordRates = rollingRates(chordGroups.map(group => group.time), Math.min(1, regionDuration), context.regionStart, context.regionEnd)

  const movementDemands: number[] = []
  const fastLeaps: number[] = []
  for (let i = 1; i < groups.length; i++) {
    const previous = groups[i - 1]
    const current = groups[i]
    const deltaTime = Math.max(0.05, current.time - previous.time)
    const distance = Math.abs(current.centerPitch - previous.centerPitch)
    movementDemands.push(distance / deltaTime)
    fastLeaps.push(distance >= 7 && deltaTime <= 0.5 ? 1 : 0)
  }

  const repetitionRates = detectRepetitionRates(groups)
  const alternationRates = detectAlternationRates(groups)
  const maxPhysicalPolyphony = calculateMaxPolyphony(notes)
  const rhythmComplexity = calculateRhythmComplexity(groups, context.ppq)
  const sustainedActivity = calculateSustainedActivity(notes, groups, context.regionStart, context.regionEnd)

  const metrics: HandMetrics = {
    noteRateP90: percentile(noteRates, 0.9),
    attackRateP90: percentile(attackRates, 0.9),
    chordRateP90: percentile(chordRates, 0.9),
    chordSizeP95: percentile(chordGroups.map(group => group.size), 0.95),
    chordSpanP90: percentile(chordGroups.map(group => group.span), 0.9),
    movementDemandP90: percentile(movementDemands, 0.9),
    fastLeapRatio: mean(fastLeaps),
    repetitionRateP90: percentile(repetitionRates, 0.9),
    alternationRateP90: percentile(alternationRates, 0.9),
    maxPhysicalPolyphony,
    rhythmComplexity,
    sustainedActivity,
  }

  const speedNormalized = clamp01(
    0.68 * normalizeByAnchors(metrics.noteRateP90, [1.2, 2.5, 4.5, 7.5, 11]) +
      0.32 * normalizeByAnchors(metrics.attackRateP90, [0.8, 1.8, 3.2, 5.2, 7.5]),
  )

  const chordNormalized = clamp01(
    0.58 * normalizeByAnchors(metrics.chordSizeP95, [1, 2, 3, 4, 5]) +
      0.42 * normalizeByAnchors(metrics.chordRateP90, [0, 0.7, 1.5, 2.8, 4.5]),
  )

  const stretchRatio = metrics.chordSpanP90 / Math.max(1, context.comfortableSpan)
  const stretchNormalized = normalizeByAnchors(stretchRatio, [0.35, 0.6, 0.8, 1, 1.25])

  const movementNormalized = clamp01(
    0.75 * normalizeByAnchors(metrics.movementDemandP90, [3, 8, 18, 35, 65]) +
      0.25 * normalizeByAnchors(metrics.fastLeapRatio, [0, 0.03, 0.08, 0.18, 0.35]),
  )

  const repetitionNormalized = Math.max(
    normalizeByAnchors(metrics.repetitionRateP90, [1, 2.5, 4.5, 7, 10]),
    normalizeByAnchors(metrics.alternationRateP90, [1, 2.5, 4.5, 7, 10]),
  )

  const polyphonyNormalized = normalizeByAnchors(metrics.maxPhysicalPolyphony, [1, 2, 3, 4, 5])

  const features: Record<string, FeatureScore> = {
    speed: makeFeature(metrics.noteRateP90, speedNormalized, 0.22),
    chords: makeFeature(metrics.chordSizeP95, chordNormalized, 0.17),
    stretch: makeFeature(stretchRatio, stretchNormalized, 0.14),
    movement: makeFeature(metrics.movementDemandP90, movementNormalized, 0.16),
    repetition: makeFeature(Math.max(metrics.repetitionRateP90, metrics.alternationRateP90), repetitionNormalized, 0.09),
    polyphony: makeFeature(metrics.maxPhysicalPolyphony, polyphonyNormalized, 0.09),
    rhythm: makeFeature(metrics.rhythmComplexity, metrics.rhythmComplexity, 0.08),
    endurance: makeFeature(metrics.sustainedActivity, normalizeByAnchors(metrics.sustainedActivity, [0, 0.08, 0.22, 0.5, 0.8]), 0.05),
  }

  let normalized = Object.values(features).reduce((sum, feature) => sum + feature.contribution, 0)
  const interactionBonus =
    0.07 * Math.min(speedNormalized, movementNormalized) +
    0.06 * Math.min(speedNormalized, chordNormalized) +
    0.04 * Math.min(stretchNormalized, chordNormalized)

  normalized = clamp01(normalized + interactionBonus)

  return {
    score: normalizedToScore(normalized),
    normalized,
    noteCount: notes.length,
    attackCount: groups.length,
    metrics: mapNumericValues(metrics, value => roundTo(value, 4)),
    features,
  }
}

function analyzeCoordination(
  leftGroupsInput: AttackGroup[],
  rightGroupsInput: AttackGroup[],
  leftDifficulty: number,
  rightDifficulty: number,
  alignmentToleranceSeconds: number,
  start: number,
  end: number,
): CoordinationDifficulty {
  const leftGroups = leftGroupsInput.filter(group => group.time >= start && group.time < end)
  const rightGroups = rightGroupsInput.filter(group => group.time >= start && group.time < end)

  if (leftGroups.length === 0 || rightGroups.length === 0) {
    return { score: 1, normalized: 0, simultaneousDemand: 0, rhythmicIndependence: 0, crossingRatio: 0, bothHandsBusy: 0 }
  }

  const duration = Math.max(0.25, end - start)
  const leftRate = leftGroups.length / duration
  const rightRate = rightGroups.length / duration
  const bothHandsBusy = Math.sqrt(
    normalizeByAnchors(leftRate, [0.5, 1.2, 2.2, 3.8, 6]) *
      normalizeByAnchors(rightRate, [0.5, 1.2, 2.2, 3.8, 6]),
  )

  const alignmentLeft = alignedRatio(leftGroups, rightGroups, alignmentToleranceSeconds)
  const alignmentRight = alignedRatio(rightGroups, leftGroups, alignmentToleranceSeconds)
  const alignment = (alignmentLeft + alignmentRight) / 2

  const rhythmicIndependence = clamp01((1 - alignment) * bothHandsBusy)
  const simultaneousDemand = Math.sqrt(leftDifficulty * rightDifficulty)
  const crossingRatio = calculateCrossingRatio(leftGroups, rightGroups, Math.max(alignmentToleranceSeconds, 0.08))

  const normalized = clamp01(
    0.48 * simultaneousDemand +
      0.37 * rhythmicIndependence +
      0.15 * normalizeByAnchors(crossingRatio, [0, 0.01, 0.05, 0.15, 0.35]),
  )

  return {
    score: normalizedToScore(normalized),
    normalized,
    simultaneousDemand: roundTo(simultaneousDemand, 4),
    rhythmicIndependence: roundTo(rhythmicIndependence, 4),
    crossingRatio: roundTo(crossingRatio, 4),
    bothHandsBusy: roundTo(bothHandsBusy, 4),
  }
}

function analyzeSegments(
  leftNotes: InternalNote[],
  rightNotes: InternalNote[],
  duration: number,
  ppq: number,
  config: DifficultyConfig,
): HardSegment[] {
  const result: HardSegment[] = []
  const window = Math.min(config.analysisWindowSeconds, Math.max(0.5, duration || config.analysisWindowSeconds))
  const lastStart = Math.max(0, duration - window)

  const starts: number[] = []
  for (let start = 0; start <= lastStart + EPSILON; start += config.hopSeconds) {
    starts.push(Math.min(start, lastStart))
  }
  if (starts.length === 0 || starts[starts.length - 1] < lastStart - EPSILON) starts.push(lastStart)

  for (const start of uniqueNumbers(starts)) {
    const end = Math.min(duration, start + window)
    const leftSlice = sliceNotesByOnset(leftNotes, start, end)
    const rightSlice = sliceNotesByOnset(rightNotes, start, end)

    if (leftSlice.length === 0 && rightSlice.length === 0) continue

    const left = analyzeHand(leftSlice, {
      hand: 'left',
      ppq,
      comfortableSpan: config.comfortableSpan.left,
      chordToleranceSeconds: config.chordToleranceSeconds,
      regionStart: start,
      regionEnd: end,
    })
    const right = analyzeHand(rightSlice, {
      hand: 'right',
      ppq,
      comfortableSpan: config.comfortableSpan.right,
      chordToleranceSeconds: config.chordToleranceSeconds,
      regionStart: start,
      regionEnd: end,
    })

    const leftGroups = groupAttacks(leftSlice, config.chordToleranceSeconds)
    const rightGroups = groupAttacks(rightSlice, config.chordToleranceSeconds)
    const coordination = analyzeCoordination(leftGroups, rightGroups, left.normalized, right.normalized, config.alignmentToleranceSeconds, start, end)

    const handBlend = 0.66 * Math.max(left.normalized, right.normalized) + 0.34 * mean([left.normalized, right.normalized])
    const localNormalized = clamp01(
      0.74 * handBlend +
        0.26 * coordination.normalized +
        0.06 * Math.min(left.normalized, right.normalized),
    )

    result.push({
      startSeconds: roundTo(start, 3),
      endSeconds: roundTo(end, 3),
      score: normalizedToScore(localNormalized),
      leftHandScore: left.score,
      rightHandScore: right.score,
      coordinationScore: coordination.score,
    })
  }

  return result
}

function calculateRhythmComplexity(groups: AttackGroup[], ppq: number): number {
  if (groups.length < 3) return 0

  const beats = groups.map(group => group.ticks / ppq)
  const iois = beats
    .slice(1)
    .map((beat, index) => beat - beats[index])
    .filter(value => value >= 1 / 64 && value <= 2)

  const medianIoi = median(iois)
  const irregularity = medianIoi > EPSILON
    ? normalizeByAnchors(median(iois.map(value => Math.abs(value - medianIoi))) / medianIoi, [0, 0.08, 0.2, 0.45, 0.9])
    : 0

  const gridComplexities = beats.map(beat => onsetGridComplexity(beat))
  const subdivisionComplexity = mean(gridComplexities)

  const offbeatRatio = mean(beats.map(beat => {
    const fraction = positiveModulo(beat, 1)
    const onQuarterOrEighth = Math.min(distanceToGrid(fraction, 1), distanceToGrid(fraction, 2))
    return onQuarterOrEighth <= 0.04 ? 0 : 1
  }))

  return clamp01(0.47 * subdivisionComplexity + 0.35 * irregularity + 0.18 * offbeatRatio)
}

function onsetGridComplexity(beat: number): number {
  const fraction = positiveModulo(beat, 1)
  const candidates = [1, 2, 3, 4, 6, 8, 12, 16] as const

  let bestDivision = 16
  let bestError = Number.POSITIVE_INFINITY
  for (const division of candidates) {
    const error = distanceToGrid(fraction, division)
    if (error < bestError) {
      bestError = error
      bestDivision = division
    }
    if (error <= 0.035) {
      bestDivision = division
      break
    }
  }

  let complexity: number
  if (bestDivision <= 2) complexity = 0.05
  else if (bestDivision <= 4) complexity = 0.28
  else if (bestDivision <= 6) complexity = 0.52
  else if (bestDivision <= 8) complexity = 0.72
  else complexity = 0.92

  if (bestError > 0.055) complexity += 0.08
  return clamp01(complexity)
}

function calculateSustainedActivity(notes: InternalNote[], groups: AttackGroup[], start: number, end: number): number {
  const duration = end - start
  if (duration <= 0 || notes.length === 0) return 0

  const window = Math.min(2, Math.max(0.5, duration))
  const hop = Math.min(0.5, window)
  const flags: number[] = []
  const noteTimes = notes.map(note => note.time)
  const groupTimes = groups.map(group => group.time)

  for (let t = start; t < end - EPSILON; t += hop) {
    const windowEnd = Math.min(end, t + window)
    const actualDuration = Math.max(0.25, windowEnd - t)
    const noteRate = countTimesInRange(noteTimes, t, windowEnd) / actualDuration
    const attackRate = countTimesInRange(groupTimes, t, windowEnd) / actualDuration
    flags.push(noteRate >= 4 || attackRate >= 3 ? 1 : 0)
  }

  return mean(flags)
}

function detectRepetitionRates(groups: AttackGroup[]): number[] {
  const lastTimeByPitch = new Map<number, number>()
  const rates: number[] = []

  for (const group of groups) {
    for (const note of group.notes) {
      const previousTime = lastTimeByPitch.get(note.midi)
      if (previousTime !== undefined) {
        const delta = group.time - previousTime
        if (delta > 0.03 && delta <= 1.2) rates.push(1 / delta)
      }
      lastTimeByPitch.set(note.midi, group.time)
    }
  }
  return rates
}

function detectAlternationRates(groups: AttackGroup[]): number[] {
  const monophonicCenters = groups.map(group => ({ time: group.time, pitch: Math.round(group.centerPitch) }))
  const rates: number[] = []

  for (let i = 2; i < monophonicCenters.length; i++) {
    const a = monophonicCenters[i - 2]
    const b = monophonicCenters[i - 1]
    const c = monophonicCenters[i]
    if (a.pitch === c.pitch && a.pitch !== b.pitch) {
      const delta = c.time - a.time
      if (delta > 0.06 && delta <= 1.5) rates.push(2 / delta)
    }
  }
  return rates
}

function calculateMaxPolyphony(notes: InternalNote[]): number {
  const events: Array<{ time: number; delta: number }> = []
  for (const note of notes) {
    events.push({ time: note.time, delta: 1 })
    events.push({ time: note.time + Math.max(0, note.duration), delta: -1 })
  }

  events.sort((a, b) => a.time - b.time || a.delta - b.delta)
  let active = 0
  let maximum = 0
  for (const event of events) {
    active = Math.max(0, active + event.delta)
    maximum = Math.max(maximum, active)
  }
  return maximum
}

function calculateCrossingRatio(leftGroups: AttackGroup[], rightGroups: AttackGroup[], tolerance: number): number {
  let comparable = 0
  let crossing = 0

  for (const left of leftGroups) {
    const right = nearestGroup(left.time, rightGroups)
    if (!right || Math.abs(right.time - left.time) > tolerance) continue
    comparable++
    if (left.centerPitch >= right.centerPitch || left.maxPitch > right.minPitch) crossing++
  }

  return comparable > 0 ? crossing / comparable : 0
}

function alignedRatio(source: AttackGroup[], target: AttackGroup[], tolerance: number): number {
  if (source.length === 0 || target.length === 0) return 0
  let aligned = 0
  for (const group of source) {
    const nearest = nearestGroup(group.time, target)
    if (nearest && Math.abs(nearest.time - group.time) <= tolerance) aligned++
  }
  return aligned / source.length
}

function nearestGroup(time: number, groups: AttackGroup[]): AttackGroup | undefined {
  if (groups.length === 0) return undefined

  let low = 0
  let high = groups.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (groups[mid].time < time) low = mid + 1
    else high = mid
  }

  const candidates = [groups[low - 1], groups[low]].filter((group): group is AttackGroup => Boolean(group))
  return candidates.reduce((best, current) => Math.abs(current.time - time) < Math.abs(best.time - time) ? current : best)
}

function groupAttacks(notesInput: InternalNote[], toleranceSeconds: number): AttackGroup[] {
  const notes = [...notesInput].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const groups: AttackGroup[] = []
  let current: InternalNote[] = []
  let groupStart = Number.NaN

  const flush = () => {
    if (current.length === 0) return
    const pitches = current.map(note => note.midi).sort((a, b) => a - b)
    groups.push({
      time: current[0].time,
      ticks: Math.min(...current.map(note => note.ticks)),
      notes: current,
      size: current.length,
      minPitch: pitches[0],
      maxPitch: pitches[pitches.length - 1],
      centerPitch: median(pitches),
      span: pitches[pitches.length - 1] - pitches[0],
    })
    current = []
    groupStart = Number.NaN
  }

  for (const note of notes) {
    if (current.length === 0) {
      current = [note]
      groupStart = note.time
      continue
    }
    if (note.time - groupStart <= toleranceSeconds + EPSILON) {
      current.push(note)
    } else {
      flush()
      current = [note]
      groupStart = note.time
    }
  }
  flush()
  return groups
}

function rollingRates(timesInput: number[], windowSeconds: number, regionStart: number, regionEnd: number): number[] {
  const times = [...timesInput].sort((a, b) => a - b)
  if (times.length === 0) return []

  const effectiveWindow = Math.max(0.25, Math.min(windowSeconds, regionEnd - regionStart))
  const rates: number[] = []
  let right = 0

  for (let left = 0; left < times.length; left++) {
    if (right < left) right = left
    const windowStart = times[left]
    const windowEnd = Math.min(regionEnd, windowStart + effectiveWindow)
    while (right < times.length && times[right] < windowEnd - EPSILON) right++
    const actualDuration = Math.max(0.25, Math.min(effectiveWindow, regionEnd - windowStart))
    rates.push((right - left) / actualDuration)
  }

  return rates
}

function selectHardSegments(segments: HardSegment[], maximum: number, windowSeconds: number): HardSegment[] {
  const selected: HardSegment[] = []
  const sorted = [...segments].sort((a, b) => b.score - a.score)

  for (const segment of sorted) {
    const overlaps = selected.some(existing => {
      const overlap = Math.max(0, Math.min(segment.endSeconds, existing.endSeconds) - Math.max(segment.startSeconds, existing.startSeconds))
      return overlap >= windowSeconds * 0.5
    })
    if (!overlaps) selected.push(segment)
    if (selected.length >= maximum) break
  }

  return selected.sort((a, b) => a.startSeconds - b.startSeconds)
}

function buildReasons(left: HandDifficulty, right: HandDifficulty, coordination: CoordinationDifficulty): string[] {
  const candidates: Array<{ impact: number; text: string }> = []

  addHandReasons(candidates, 'Tay trái', left)
  addHandReasons(candidates, 'Tay phải', right)

  candidates.push({ impact: coordination.simultaneousDemand * 0.48, text: `Hai tay cùng chịu tải kỹ thuật cao (${formatPercent(coordination.simultaneousDemand)}).` })
  candidates.push({ impact: coordination.rhythmicIndependence * 0.37, text: `Hai tay có tiết tấu tương đối độc lập (${formatPercent(coordination.rhythmicIndependence)}).` })
  candidates.push({ impact: coordination.crossingRatio * 0.15, text: `Có dấu hiệu hai tay giao/cắt vùng phím (${formatPercent(coordination.crossingRatio)} số lần có thể so sánh).` })

  return candidates
    .filter(candidate => candidate.impact >= 0.025)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 6)
    .map(candidate => candidate.text)
}

function addHandReasons(target: Array<{ impact: number; text: string }>, label: string, hand: HandDifficulty) {
  const f = hand.features
  target.push({ impact: f.speed.contribution, text: `${label}: mật độ cực đại khoảng ${hand.metrics.noteRateP90.toFixed(1)} note/giây.` })
  target.push({ impact: f.chords.contribution, text: `${label}: hợp âm P95 khoảng ${hand.metrics.chordSizeP95.toFixed(1)} nốt, tốc độ hợp âm P90 ${hand.metrics.chordRateP90.toFixed(1)}/giây.` })
  target.push({ impact: f.stretch.contribution, text: `${label}: độ giãn hợp âm P90 là ${hand.metrics.chordSpanP90.toFixed(1)} semitone.` })
  target.push({ impact: f.movement.contribution, text: `${label}: yêu cầu dịch chuyển P90 là ${hand.metrics.movementDemandP90.toFixed(1)} semitone/giây.` })
  target.push({ impact: f.repetition.contribution, text: `${label}: lặp nốt/trill đạt khoảng ${Math.max(hand.metrics.repetitionRateP90, hand.metrics.alternationRateP90).toFixed(1)} lần/giây.` })
  target.push({ impact: f.rhythm.contribution, text: `${label}: độ phức tạp tiết tấu ${formatPercent(hand.metrics.rhythmComplexity)}.` })
}

function buildWarnings(leftNotes: InternalNote[], rightNotes: InternalNote[], left: HandDifficulty, right: HandDifficulty, duration: number): string[] {
  const warnings: string[] = []
  if (duration < 8) warnings.push('MIDI rất ngắn; điểm số dễ bị chi phối bởi một vài ô nhịp.')
  if (leftNotes.length < 8 || rightNotes.length < 8) warnings.push('Một trong hai track có rất ít note; điểm phối hợp hai tay có độ tin cậy thấp.')
  if (left.metrics.maxPhysicalPolyphony > 5) warnings.push('Track tay trái có hơn 5 phím giữ đồng thời; hãy kiểm tra pedal, note-off hoặc cách tách voice.')
  if (right.metrics.maxPhysicalPolyphony > 5) warnings.push('Track tay phải có hơn 5 phím giữ đồng thời; hãy kiểm tra pedal, note-off hoặc cách tách voice.')
  return warnings
}

function toInternalNotes(notes: Array<{ midi: number; time: number; duration: number; ticks: number }>): InternalNote[] {
  return notes
    .filter(note => Number.isFinite(note.midi) && Number.isFinite(note.time) && Number.isFinite(note.duration) && Number.isFinite(note.ticks))
    .map(note => ({
      midi: note.midi,
      time: Math.max(0, note.time),
      duration: Math.max(0, note.duration),
      ticks: Math.max(0, note.ticks),
    }))
    .sort((a, b) => a.time - b.time || a.midi - b.midi)
}

function sliceNotesByOnset(notes: InternalNote[], start: number, end: number): InternalNote[] {
  return notes.filter(note => note.time >= start && note.time < end)
}

function makeFeature(value: number, normalized: number, weight: number): FeatureScore {
  return {
    value: roundTo(value, 4),
    normalized: roundTo(clamp01(normalized), 4),
    weight,
    contribution: roundTo(clamp01(normalized) * weight, 4),
  }
}

function emptyHandDifficulty(): HandDifficulty {
  const zeroFeature = (weight: number): FeatureScore => ({ value: 0, normalized: 0, weight, contribution: 0 })
  return {
    score: 1,
    normalized: 0,
    noteCount: 0,
    attackCount: 0,
    metrics: {
      noteRateP90: 0,
      attackRateP90: 0,
      chordRateP90: 0,
      chordSizeP95: 0,
      chordSpanP90: 0,
      movementDemandP90: 0,
      fastLeapRatio: 0,
      repetitionRateP90: 0,
      alternationRateP90: 0,
      maxPhysicalPolyphony: 0,
      rhythmComplexity: 0,
      sustainedActivity: 0,
    },
    features: {
      speed: zeroFeature(0.22),
      chords: zeroFeature(0.17),
      stretch: zeroFeature(0.14),
      movement: zeroFeature(0.16),
      repetition: zeroFeature(0.09),
      polyphony: zeroFeature(0.09),
      rhythm: zeroFeature(0.08),
      endurance: zeroFeature(0.05),
    },
  }
}

function normalizeByAnchors(value: number, anchors: readonly number[]): number {
  if (anchors.length < 2) throw new Error('Cần ít nhất hai mốc chuẩn hóa.')
  if (value <= anchors[0]) return 0
  const lastIndex = anchors.length - 1
  if (value >= anchors[lastIndex]) return 1

  for (let i = 0; i < lastIndex; i++) {
    const low = anchors[i]
    const high = anchors[i + 1]
    if (value <= high) {
      const local = (value - low) / Math.max(EPSILON, high - low)
      return (i + local) / lastIndex
    }
  }
  return 1
}

function normalizedToScore(normalized: number): number {
  return roundTo(1 + 9 * Math.pow(clamp01(normalized), 0.9), 2)
}

function scoreToNormalized(score: number): number {
  return clamp01(Math.pow((score - 1) / 9, 1 / 0.9))
}

function difficultyLabel(score: number): string {
  if (score <= 2) return 'Rất dễ'
  if (score <= 4) return 'Dễ'
  if (score <= 6) return 'Trung bình'
  if (score <= 8) return 'Khó'
  if (score === 9) return 'Rất khó'
  return 'Virtuoso / chuyên nghiệp'
}

function validateOptions(options: DifficultyOptions): void {
  if (!Number.isInteger(options.leftTrackIndex) || options.leftTrackIndex < 0) throw new TypeError('leftTrackIndex phải là số nguyên >= 0.')
  if (!Number.isInteger(options.rightTrackIndex) || options.rightTrackIndex < 0) throw new TypeError('rightTrackIndex phải là số nguyên >= 0.')
  if (options.leftTrackIndex === options.rightTrackIndex) throw new Error('Track tay trái và tay phải phải khác nhau.')
  validateConfigValues(options)
}

function validateConfigValues(options: Omit<DifficultyOptions, 'leftTrackIndex' | 'rightTrackIndex'>): void {
  const positiveOptions: Array<[string, number | undefined]> = [
    ['analysisWindowSeconds', options.analysisWindowSeconds],
    ['hopSeconds', options.hopSeconds],
    ['chordToleranceSeconds', options.chordToleranceSeconds],
    ['handAlignmentToleranceSeconds', options.handAlignmentToleranceSeconds],
    ['comfortableSpanSemitones.left', options.comfortableSpanSemitones?.left],
    ['comfortableSpanSemitones.right', options.comfortableSpanSemitones?.right],
  ]
  for (const [name, value] of positiveOptions) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new TypeError(`${name} phải là số dương.`)
  }
}

function validatePpq(ppq: number): void {
  if (!Number.isFinite(ppq) || ppq <= 0) throw new Error(`PPQ không hợp lệ: ${ppq}`)
}

function percentile(valuesInput: number[], q: number): number {
  const values = valuesInput.filter(Number.isFinite).sort((a, b) => a - b)
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]
  const position = clamp01(q) * (values.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const fraction = position - lower
  return values[lower] * (1 - fraction) + values[upper] * fraction
}

function median(values: number[]): number {
  return percentile(values, 0.5)
}

function mean(values: number[]): number {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return 0
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

function distanceToGrid(fraction: number, division: number): number {
  const scaled = fraction * division
  return Math.abs(scaled - Math.round(scaled)) / division
}

function countTimesInRange(times: number[], start: number, end: number): number {
  let count = 0
  for (const time of times) if (time >= start && time < end) count++
  return count
}

function lastNoteEnd(notes: InternalNote[]): number {
  return notes.reduce((maximum, note) => Math.max(maximum, note.time + note.duration), 0)
}

function uniqueNumbers(values: number[]): number[] {
  return values.filter((value, index) => index === 0 || Math.abs(value - values[index - 1]) > EPSILON)
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`
}

function mapNumericValues<T extends object>(object: T, mapper: (value: number) => number): T {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, typeof value === 'number' ? mapper(value) : value])) as T
}

function toMidiBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}
