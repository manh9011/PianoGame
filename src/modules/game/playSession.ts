import type { MetronomeBeat } from '../audio/metronomePlayer'
import type { TempoPoint } from '../midi/midiTempo'
import type { MidiBookmarkSource, TranslatedNote } from '../midi/midiTypes'
import { resolveTrackModeForSession, type TrackProperties } from './trackProperties'
import { createScoreState, type ScoreState } from './scoring'
import type { KeyboardRange } from '../render/keyboardRange'

export type PlayMode = 'listen' | 'noteMemory' | 'practice' | 'performance'
export type HandSelection = 'left' | 'right' | 'both'
export type Hand = 'left' | 'right' | 'unknown'
export type BackgroundScoreHand = 'left' | 'right'
export type FailureReason = 'wrongNote' | 'missedNote' | 'strayNote'

export interface SessionNote extends TranslatedNote { hand: Hand; finger?: number | null; fingerSource?: 'manual' | 'auto'; fingerCost?: number }
export interface SessionBookmark { id: string; timeUs: number; source: MidiBookmarkSource | 'user'; label: string; color: string }
export interface UserBookmark { id: string; timeUs: number; label: string }
export interface SessionKeySignature { id: string; timeUs: number; label: string; accidentals: number; key?: string; scale?: string }
export interface LoopState {
  enabled: boolean
  startUs: number
  endUs: number
  durationUs: number
  delayBetweenLoops: number
  restartAfterErrors: number
}
export interface PlayModeConfig { mode: PlayMode; scoringEnabled: boolean; pauseAllowed: boolean; speedChangeAllowed: boolean; stopOnWrongNote: boolean; fixedSpeed?: number }
export interface PlaySessionOptions { mode?: PlayMode; handSelection?: HandSelection; speed: number; showDuration: number; octaveShift: number; tempoMap?: TempoPoint[]; measureGridUs?: number[]; metronomeBeatGrid?: MetronomeBeat[]; bookmarks?: SessionBookmark[]; keySignatures?: SessionKeySignature[]; durationUs?: number }
export interface ConfigureSessionOptions { mode: PlayMode; handSelection: HandSelection; speed: number }

export interface PlaySession {
  notes: SessionNote[]
  tracks: TrackProperties[]
  mode: PlayMode
  modeConfig: PlayModeConfig
  handSelection: HandSelection
  setupComplete: boolean
  needsTrackConfiguration: boolean
  speed: number
  paused: boolean
  showDuration: number
  octaveShift: number
  tempoMap: TempoPoint[]
  measureGridUs: number[]
  metronomeBeatGrid: MetronomeBeat[]
  bookmarks: SessionBookmark[]
  userBookmarks: UserBookmark[]
  keySignatures: SessionKeySignature[]
  keyboardRange: KeyboardRange | null
  activeNotes: Set<number>
  activeNoteHands: Map<number, Hand>
  activeNoteTrackIds: Map<number, number>
  activeNotePressCounts: Map<number, number>
  autoActiveNotes: Set<number>
  autoActiveNoteHands: Map<number, Hand>
  autoActiveNoteTrackIds: Map<number, number>
  autoActiveNotePressCounts: Map<number, number>
  keyboardVisualVersion: number
  fingeringVersion: number
  score: ScoreState
  backgroundScores?: Partial<Record<BackgroundScoreHand, ScoreState>>
  currentUs: number
  finished: boolean
  failed: boolean
  failureReason?: FailureReason
  melodyWaitNoteId?: string
  melodyWaitStartedMs?: number
  loopState: LoopState
}

export const PLAY_MODE_CONFIGS: Record<PlayMode, PlayModeConfig> = {
  listen: { mode: 'listen', scoringEnabled: false, pauseAllowed: true, speedChangeAllowed: true, stopOnWrongNote: false },
  noteMemory: { mode: 'noteMemory', scoringEnabled: true, pauseAllowed: true, speedChangeAllowed: true, stopOnWrongNote: true },
  practice: { mode: 'practice', scoringEnabled: true, pauseAllowed: true, speedChangeAllowed: true, stopOnWrongNote: false },
  performance: { mode: 'performance', scoringEnabled: true, pauseAllowed: false, speedChangeAllowed: false, stopOnWrongNote: false, fixedSpeed: 100 },
}

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  listen: 'Watch and Listen Only',
  noteMemory: 'Practice the Melody',
  practice: 'Practice the Rhythm',
  performance: 'Song Recital',
}

export const HAND_LABELS: Record<HandSelection, string> = {
  left: 'Tay trái',
  right: 'Tay phải',
  both: 'Cả hai tay',
}

export function createBackgroundScores(handSelection: HandSelection, scoringEnabled: boolean): PlaySession['backgroundScores'] {
  return handSelection === 'both' && scoringEnabled
    ? { left: createScoreState(), right: createScoreState() }
    : undefined
}

export function createPlaySession(notes: SessionNote[], tracks: TrackProperties[], options: PlaySessionOptions & { needsTrackConfiguration?: boolean }): PlaySession {
  const mode = options.mode ?? 'practice'
  const modeConfig = PLAY_MODE_CONFIGS[mode]
  const speed = modeConfig.fixedSpeed ?? clampSpeed(options.speed)
  const durationUs = options.durationUs ?? 0
  return {
    notes: notes.map(n => ({ ...n, state: 'waiting' })),
    tracks,
    mode,
    modeConfig,
    handSelection: options.handSelection ?? 'both',
    setupComplete: false,
    needsTrackConfiguration: options.needsTrackConfiguration ?? false,
    speed,
    paused: true,
    showDuration: clampShowDuration(options.showDuration),
    octaveShift: options.octaveShift,
    tempoMap: options.tempoMap ?? [],
    measureGridUs: options.measureGridUs ?? [],
    metronomeBeatGrid: options.metronomeBeatGrid ?? [],
    bookmarks: options.bookmarks ?? [],
    userBookmarks: [],
    keySignatures: options.keySignatures ?? [],
    keyboardRange: null,
    activeNotes: new Set(),
    activeNoteHands: new Map(),
    activeNoteTrackIds: new Map(),
    activeNotePressCounts: new Map(),
    autoActiveNotes: new Set(),
    autoActiveNoteHands: new Map(),
    autoActiveNoteTrackIds: new Map(),
    autoActiveNotePressCounts: new Map(),
    keyboardVisualVersion: 0,
    fingeringVersion: 0,
    score: createScoreState(),
    backgroundScores: createBackgroundScores(options.handSelection ?? 'both', modeConfig.scoringEnabled),
    currentUs: -5_500_000,
    finished: false,
    failed: false,
    melodyWaitNoteId: undefined,
    melodyWaitStartedMs: undefined,
    loopState: {
      enabled: false,
      startUs: 0,
      endUs: 0,
      durationUs,
      delayBetweenLoops: 0,
      restartAfterErrors: 0,
    },
  }
}

export function applySessionOptions(session: PlaySession, options: ConfigureSessionOptions) {
  const modeConfig = PLAY_MODE_CONFIGS[options.mode]
  session.mode = options.mode
  session.modeConfig = modeConfig
  session.handSelection = options.handSelection
  session.speed = modeConfig.fixedSpeed ?? clampSpeed(options.speed)
  session.setupComplete = true
  session.paused = true
  session.failed = false
  session.failureReason = undefined
  session.melodyWaitNoteId = undefined
  session.melodyWaitStartedMs = undefined
  session.finished = false
  session.score = createScoreState()
  session.backgroundScores = createBackgroundScores(session.handSelection, session.modeConfig.scoringEnabled)
  session.activeNotes.clear()
  session.activeNoteHands.clear()
  session.activeNoteTrackIds.clear()
  session.activeNotePressCounts.clear()
  session.autoActiveNotes.clear()
  session.autoActiveNoteHands.clear()
  session.autoActiveNoteTrackIds.clear()
  session.autoActiveNotePressCounts.clear()
  session.keyboardVisualVersion += 1
  session.notes = session.notes.map(n => ({ ...n, state: 'waiting' }))
  session.tracks.forEach(track => { track.mode = resolveTrackModeForSession(track, options.mode) })
}

export function clampSpeed(v: number) { return Math.max(0, Math.min(400, Math.round(v / 10) * 10)) }
export function clampShowDuration(v: number) { return Math.max(0.25, Math.min(10, v)) }
