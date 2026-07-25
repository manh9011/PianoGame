import { defineStore } from 'pinia'
import type { SongMetadata } from '../types/song'
import { base64ToBuffer, loadSongMidiData } from '../modules/library/songLibrary'
import { parseMidi } from '../modules/midi/midiParser'
import { translateNotes } from '../modules/midi/midiNoteTranslator'
import type { MidiBookmarkSource } from '../modules/midi/midiTypes'
import { buildTempoMap, pulseToMicroseconds } from '../modules/midi/midiTempo'
import { createDefaultTrackProperties, isTrackRoleComplete, resolveTrackModeForSession, roleToHandAssignment, TRACK_ROLE_COLORS, type TrackMode, type TrackProperties, type TrackRole } from '../modules/game/trackProperties'
import { PLAY_MODE_CONFIGS, clampShowDuration, clampSpeed, createBackgroundScores, createPlaySession, type BackgroundScoreHand, type ConfigureSessionOptions, type FailureReason, type LoopState, type PlaySession, type SessionNote } from '../modules/game/playSession'
import { getKeyboardRange } from '../modules/render/keyboardRange'
import { getKeySignatureAccidentals } from '../modules/render/pianoLabels'
import { MidiPlayerClock } from '../modules/midi/midiPlayerClock'
import { collectChordAtStart, findEarliestPlayableWaitingStart, findHit, HIT_WINDOW_US, isPlayableNote, markMisses } from '../modules/game/hitDetection'
import { awardHoldPoints, createScoreState, recordHit, recordMiss, recordMisses, recordStray, resetSpeedTrackingAnchor, stopHoldsForInput, summarizeScoreWithinRange, trimScoreAfter, updateSpeedTracking, type ScoreState } from '../modules/game/scoring'
import { summarizeStats, type SongPlayStats } from '../modules/game/songStatistics'
import { assignHands } from '../modules/game/handAssignment'
import { requestPianoFingering } from '../modules/fingering/fingeringClient'
import type { FingeringAssignment, FingerNumber, HandSizePreset } from '../modules/fingering/fingeringTypes'
import { AutoNotePlayer } from '../modules/audio/autoNotePlayer'
import { MetronomePlayer, type MetronomeBeat } from '../modules/audio/metronomePlayer'
import { SimpleSynth } from '../modules/audio/simpleSynth'
import { getInstrumentByProgram } from '../modules/audio/gmInstrumentCatalog'
import { useSettingsStore } from './settingsStore'
import { useProfileStore } from './profileStore'
import { addActivePlaybackCounter, addPlaybackCounter, beginSimulationTick, endSimulationTick, isPlaybackProfilerDetailEnabled, measurePlaybackSpan, recordPlaybackEvent, setPlaybackGauge } from '../modules/perf/playbackProfiler'

function getTimeSignatures(midi: ReturnType<typeof parseMidi>) {
  const signatures = midi.events
    .filter(event => event.type === 'timeSignature' && event.numerator && event.denominator)
    .map(event => ({ pulse: event.pulse, numerator: event.numerator ?? 4, denominator: event.denominator ?? 4 }))
    .sort((a, b) => a.pulse - b.pulse)
  if (!signatures.length || signatures[0].pulse > 0) signatures.unshift({ pulse: 0, numerator: 4, denominator: 4 })
  return signatures
}

function createMeasureGrid(midi: ReturnType<typeof parseMidi>, tempoMap: ReturnType<typeof buildTempoMap>) {
  const pulses = new Set<number>()
  const signatures = getTimeSignatures(midi)
  for (let i = 0; i < signatures.length; i++) {
    const signature = signatures[i]
    const next = signatures[i + 1]
    const pulsesPerMeasure = midi.header.ticksPerQuarter * signature.numerator * (4 / signature.denominator)
    if (pulsesPerMeasure <= 0) continue
    const endPulse = next?.pulse ?? midi.durationPulse + pulsesPerMeasure
    for (let pulse = signature.pulse; pulse <= endPulse; pulse += pulsesPerMeasure) {
      pulses.add(Math.round(pulse))
    }
  }

  return [...pulses]
    .sort((a, b) => a - b)
    .map(pulse => pulseToMicroseconds(pulse, midi.header.ticksPerQuarter, tempoMap))
}

function createMetronomeBeatGrid(midi: ReturnType<typeof parseMidi>, tempoMap: ReturnType<typeof buildTempoMap>): MetronomeBeat[] {
  const beats: MetronomeBeat[] = []
  const signatures = getTimeSignatures(midi)

  for (let i = 0; i < signatures.length; i++) {
    const signature = signatures[i]
    const next = signatures[i + 1]
    const pulsesPerBeat = midi.header.ticksPerQuarter * (4 / signature.denominator)
    const pulsesPerMeasure = pulsesPerBeat * signature.numerator
    if (pulsesPerBeat <= 0 || pulsesPerMeasure <= 0) continue

    const startPulse = Math.max(0, signature.pulse)
    const endPulse = next?.pulse ?? midi.durationPulse + pulsesPerMeasure
    for (let pulse = startPulse; pulse <= endPulse; pulse += pulsesPerBeat) {
      const beatInMeasure = Math.round((pulse - signature.pulse) / pulsesPerBeat) % signature.numerator
      beats.push({
        timeUs: pulseToMicroseconds(Math.round(pulse), midi.header.ticksPerQuarter, tempoMap),
        firstBeat: beatInMeasure === 0,
      })
    }
  }

  return beats
    .sort((a, b) => a.timeUs - b.timeUs)
    .filter((beat, index, all) => index === 0 || beat.timeUs !== all[index - 1].timeUs)
}

const BOOKMARK_COLORS: Record<MidiBookmarkSource, string> = {
  metadata: '#FF7F00',
  keySignature: '#a855f7',
  midiMarker: '#22d3ee',
}

function handForRole(role: TrackRole | undefined) {
  if (role === 'left' || role === 'right') return role
  if (role === 'background') return 'unknown'
  return undefined
}

function applyTrackRoleToNotes(session: PlaySession, trackId: number, role: TrackRole | undefined) {
  const hand = handForRole(role)
  if (!hand) return
  session.notes = session.notes.map(note => note.trackId === trackId ? { ...note, hand } : note)
  markKeyboardVisualChanged(session)
}

function applyFingeringAssignments(session: PlaySession, assignments: FingeringAssignment[]) {
  const byNoteId = new Map(assignments.map(assignment => [assignment.noteId, assignment]))
  session.notes = session.notes.map(note => {
    const assignment = byNoteId.get(note.id)
    if (!assignment) return note
    return {
      ...note,
      hand: assignment.hand,
      finger: assignment.finger,
      fingerSource: assignment.source,
      fingerCost: assignment.cost,
    }
  })
  markFingeringChanged(session)
}

function toFingerNumber(value: number | null | undefined): FingerNumber | null {
  return value && value >= 1 && value <= 5 ? value as FingerNumber : null
}

function persistSessionFingering(songId: string | undefined, session: PlaySession, handSize?: HandSizePreset) {
  if (!songId) return
  const assignments = session.notes
    .filter(note => note.finger && (note.hand === 'left' || note.hand === 'right'))
    .map(note => ({
      noteId: note.id,
      hand: note.hand as 'left' | 'right',
      finger: note.finger as number,
      source: note.fingerSource ?? 'manual' as const,
      cost: note.fingerCost,
    }))
  useProfileStore().saveFingering(songId, assignments, handSize)
}

function restoreSavedFingering(songId: string, session: PlaySession) {
  const saved = useProfileStore().fingeringFor(songId)
  if (!saved?.assignments.length) return
  const byNoteId = new Map(saved.assignments.map(assignment => [assignment.noteId, assignment]))
  session.notes = session.notes.map(note => {
    const assignment = byNoteId.get(note.id)
    const finger = toFingerNumber(assignment?.finger)
    if (!assignment || !finger) return note
    return {
      ...note,
      hand: assignment.hand,
      finger,
      fingerSource: assignment.source,
      fingerCost: assignment.cost,
    }
  })
  markFingeringChanged(session)
}

function persistSessionTrackSettings(songId: string | undefined, session: PlaySession) {
  if (!songId) return
  useProfileStore().saveTrackSettings(songId, session.tracks.map(track => ({
    trackId: track.trackId,
    mode: track.mode,
    color: track.color,
    hitColor: track.hitColor,
    blackColor: track.blackColor,
    handAssignment: track.handAssignment,
    role: track.role,
    instrumentProgram: track.instrumentProgram,
  })))
}

function restoreSavedTrackSettings(songId: string, session: PlaySession) {
  const saved = useProfileStore().trackSettingsFor(songId)
  if (!saved?.tracks.length) return
  const byTrackId = new Map(saved.tracks.map(track => [track.trackId, track]))
  session.tracks = session.tracks.map(track => {
    const savedTrack = byTrackId.get(track.trackId)
    if (!savedTrack) return track
    return {
      ...track,
      mode: savedTrack.mode,
      color: savedTrack.color,
      hitColor: savedTrack.hitColor ?? track.hitColor,
      blackColor: savedTrack.blackColor ?? track.blackColor,
      handAssignment: savedTrack.handAssignment,
      role: savedTrack.role,
      instrumentProgram: savedTrack.instrumentProgram,
    }
  })
  for (const track of session.tracks) applyTrackRoleToNotes(session, track.trackId, track.role)
  session.needsTrackConfiguration = session.tracks.some(track => !isTrackRoleComplete(track))
}

function updateTrack(session: PlaySession | null, trackId: number, updater: (track: TrackProperties) => void) {
  const track = session?.tracks.find(item => item.trackId === trackId)
  if (!session || !track) return false
  updater(track)
  return true
}

function markKeyboardVisualChanged(session: PlaySession) {
  session.keyboardVisualVersion += 1
}

function markFingeringChanged(session: PlaySession) {
  session.fingeringVersion += 1
  markKeyboardVisualChanged(session)
}

function clearActiveNoteMetadata(session: PlaySession) {
  session.activeNotes.clear()
  session.activeNoteHands.clear()
  session.activeNoteTrackIds.clear()
  session.activeNotePressCounts.clear()
  session.autoActiveNotes.clear()
  session.autoActiveNoteHands.clear()
  session.autoActiveNoteTrackIds.clear()
  session.autoActiveNotePressCounts.clear()
  markKeyboardVisualChanged(session)
}

function getTrackSoundfont(session: PlaySession, trackId: number | undefined) {
  const track = session.tracks.find(t => t.trackId === trackId)
  return getInstrumentByProgram(track?.instrumentProgram).soundfontId
}

function getLoopSnapGrid(session: PlaySession) {
  const grid = session.metronomeBeatGrid.length
    ? session.metronomeBeatGrid.map(beat => beat.timeUs)
    : session.measureGridUs
  return [...new Set([0, ...grid.filter(us => us >= 0 && us <= session.loopState.durationUs), session.loopState.durationUs])]
    .sort((a, b) => a - b)
}

function countWaitingNotes(session: PlaySession) {
  if (!isPlaybackProfilerDetailEnabled()) return 0
  let total = 0
  for (const note of session.notes) if (note.state === 'waiting') total += 1
  return total
}

function playableAutoTestNotes(session: PlaySession, currentUs: number) {
  return session.notes.filter(note =>
    note.state === 'waiting' &&
    note.start <= currentUs &&
    isPlayableNote(note, session.tracks, session.handSelection, session)
  )
}

function resetBackgroundScores(session: PlaySession) {
  session.backgroundScores = createBackgroundScores(session.handSelection, session.modeConfig.scoringEnabled)
}

function activeScoresFor(session: PlaySession): ScoreState[] {
  const scores = [session.score]
  if (session.backgroundScores?.left) scores.push(session.backgroundScores.left)
  if (session.backgroundScores?.right) scores.push(session.backgroundScores.right)
  return scores
}

function scoreForHand(session: PlaySession, hand: BackgroundScoreHand) {
  return session.backgroundScores?.[hand]
}

function backgroundHandForNote(note: SessionNote): BackgroundScoreHand | null {
  return note.hand === 'left' || note.hand === 'right' ? note.hand : null
}

function recordMissForSessionNote(session: PlaySession, note: SessionNote) {
  recordMiss(session.score, note)
  const hand = backgroundHandForNote(note)
  const handScore = hand ? scoreForHand(session, hand) : undefined
  if (handScore) recordMiss(handScore, note)
}

function recordMissesForSessionNotes(session: PlaySession, notes: SessionNote[]) {
  recordMisses(session.score, notes)
  const leftNotes = notes.filter(note => note.hand === 'left')
  const rightNotes = notes.filter(note => note.hand === 'right')
  if (leftNotes.length && session.backgroundScores?.left) recordMisses(session.backgroundScores.left, leftNotes)
  if (rightNotes.length && session.backgroundScores?.right) recordMisses(session.backgroundScores.right, rightNotes)
}

function recordHitForSessionNote(session: PlaySession, note: SessionNote, hitAtUs: number, inputNoteId: number, nowMs: number) {
  recordHit(session.score, note, hitAtUs, inputNoteId, nowMs)
  const hand = backgroundHandForNote(note)
  const handScore = hand ? scoreForHand(session, hand) : undefined
  if (handScore) recordHit(handScore, note, hitAtUs, inputNoteId, nowMs)
}

function inferStrayHand(session: PlaySession, _playableNoteId: number): BackgroundScoreHand | null {
  const currentUs = session.currentUs
  const candidates = session.notes.filter(note =>
    note.state === 'waiting' &&
    isPlayableNote(note, session.tracks, session.handSelection, session) &&
    Math.abs(note.start - currentUs) <= HIT_WINDOW_US
  )
  const hands = new Set<BackgroundScoreHand>()
  for (const note of candidates) {
    const hand = backgroundHandForNote(note)
    if (hand) hands.add(hand)
  }
  return hands.size === 1 ? [...hands][0] : null
}

function recordStrayForTargets(session: PlaySession, atUs: number, playableNoteId?: number) {
  recordStray(session.score, atUs)
  if (playableNoteId === undefined) return
  const hand = inferStrayHand(session, playableNoteId)
  const handScore = hand ? scoreForHand(session, hand) : undefined
  if (handScore) recordStray(handScore, atUs)
}

function summarizeCompletedStats(session: PlaySession) {
  const stats = summarizeStats(session.score, session)
  const batch = [stats]
  if (session.handSelection === 'both' && session.modeConfig.scoringEnabled) {
    if (session.backgroundScores?.left) batch.push(summarizeStats(session.backgroundScores.left, session, { handSelection: 'left' }))
    if (session.backgroundScores?.right) batch.push(summarizeStats(session.backgroundScores.right, session, { handSelection: 'right' }))
  }
  return { stats, batch }
}

const BOOKMARK_SEEK_EPSILON_US = 10_000
const FALLBACK_BOOKMARK_US = 1_000_000
const SEEK_PRE_ROLL_US = 3_000_000

export interface LoopAttemptSummary {
  id: string
  loopIndex: number
  score: number
  errorCount: number
  totalNotes: number
  startedAtUs: number
  endedAtUs: number
  completedAt: number
}

export function isLoopRegionConfigured(loop?: LoopState | null) {
  if (!loop) return false
  return (loop.startUs > 0 || loop.endUs > 0) && loop.endUs > loop.startUs
}

function clampLoopRegion(startUs: number, endUs: number, durationUs: number) {
  const start = Math.max(0, Math.min(durationUs, startUs))
  const end = Math.max(0, Math.min(durationUs, endUs))
  return { startUs: start, endUs: end }
}

function getBookmarkSeekPoints(session: PlaySession) {
  const durationUs = Math.max(0, session.loopState.durationUs)
  const points = [
    ...session.bookmarks.map(bookmark => bookmark.timeUs),
    ...session.userBookmarks.map(bookmark => bookmark.timeUs),
  ]
    .filter(timeUs => timeUs >= 0 && timeUs <= durationUs)
    .sort((a, b) => a - b)

  const uniquePoints = points.filter((timeUs, index) => index === 0 || timeUs !== points[index - 1])
  return uniquePoints.length ? uniquePoints : [Math.min(FALLBACK_BOOKMARK_US, durationUs)]
}

function createSessionBookmarks(midi: ReturnType<typeof parseMidi>, tempoMap: ReturnType<typeof buildTempoMap>) {
  return midi.bookmarks.map((bookmark, index) => ({
    id: `${bookmark.source}:${bookmark.pulse}:${index}`,
    timeUs: pulseToMicroseconds(bookmark.pulse, midi.header.ticksPerQuarter, tempoMap),
    source: bookmark.source,
    label: bookmark.label,
    color: BOOKMARK_COLORS[bookmark.source],
  }))
}

function createSessionKeySignatures(midi: ReturnType<typeof parseMidi>, tempoMap: ReturnType<typeof buildTempoMap>) {
  return midi.keySignatures.map((signature, index) => ({
    id: `key:${signature.pulse}:${index}`,
    timeUs: pulseToMicroseconds(signature.pulse, midi.header.ticksPerQuarter, tempoMap),
    label: signature.label,
    accidentals: getKeySignatureAccidentals(signature.key, signature.scale),
  }))
}

export const usePlayerStore = defineStore('player', {
  state: () => ({
    song: null as SongMetadata | null,
    session: null as PlaySession | null,
    clock: null as MidiPlayerClock | null,
    stats: null as SongPlayStats | null,
    completedStatsBatch: [] as SongPlayStats[],
    autoPlayer: new AutoNotePlayer(),
    metronome: new MetronomePlayer(),
    inputSynth: new SimpleSynth(),
    currentProgress: 0,
    trackPreviewPlayer: new AutoNotePlayer(),
    trackPreviewClock: null as MidiPlayerClock | null,
    trackPreviewSession: null as PlaySession | null,
    trackPreviewTrackId: null as number | null,
    trackPreviewRunning: false,
    performanceAutoPlay: false,
    performanceAutoPlayUsed: false,
    fingeringGenerating: false,
    fingeringError: null as string | null,
    playbackManuallyStopped: false,
    playbackRunning: false,
    playbackOutputBlocked: false,
    playbackOutputBlockCount: 0,
    loopAttemptHistory: [] as LoopAttemptSummary[],
    loopAttemptCounter: 0,
  }),
  getters: {
    canSeek: state => !!state.session?.setupComplete && !state.stats && !state.session.finished && state.session.mode !== 'performance',
    loopRegionConfigured: state => isLoopRegionConfigured(state.session?.loopState),
    recentLoopAttempts: state => state.loopAttemptHistory.slice(-5).reverse(),
    bestLoopAttempt: state => state.loopAttemptHistory.reduce<LoopAttemptSummary | null>((best, attempt) => {
      if (!best) return attempt
      if (attempt.score !== best.score) return attempt.score > best.score ? attempt : best
      if (attempt.errorCount !== best.errorCount) return attempt.errorCount < best.errorCount ? attempt : best
      return attempt.loopIndex > best.loopIndex ? attempt : best
    }, null),
  },
  actions: {
    refreshKeyboardRange() {
      const session = this.session
      if (!session) return
      const settings = useSettingsStore()
      session.keyboardRange = getKeyboardRange(settings.keyboardRangeMode, session.notes)
    },
    async loadSong(song: SongMetadata, speed = 100, showDuration = 3.25, octaveShift = 0) {
      const data = song.data ?? song.midiData ?? await loadSongMidiData(song.id)
      if (!data) throw new Error('Bài hát không có dữ liệu MIDI')
      const midi = parseMidi(base64ToBuffer(data))
      const { notes, needsManualAssignment } = assignHands(translateNotes(midi))
      const trackIds = [...new Set(notes.map(n => n.trackId))]
      const tracks = createDefaultTrackProperties(trackIds.map(trackId => {
        const info = midi.tracks.find(track => track.trackId === trackId)
        const trackNotes = notes.filter(note => note.trackId === trackId)
        const hands = [...new Set(trackNotes.map(note => note.hand).filter(hand => hand === 'left' || hand === 'right'))]
        const role = info?.isPercussion ? 'background' : hands.length === 1 ? hands[0] : hands.length > 1 ? 'background' : undefined
        return {
          trackId,
          instrumentProgram: info?.instrumentProgram,
          role,
          percussion: info?.isPercussion,
        }
      }))
      const tempoMap = buildTempoMap(midi)
      const duration = pulseToMicroseconds(midi.durationPulse, midi.header.ticksPerQuarter, tempoMap)
      const measureGridUs = createMeasureGrid(midi, tempoMap)
      const metronomeBeatGrid = createMetronomeBeatGrid(midi, tempoMap)
      const bookmarks = createSessionBookmarks(midi, tempoMap)
      const keySignatures = createSessionKeySignatures(midi, tempoMap)
      this.song = song
      this.session = createPlaySession(notes, tracks, { speed, showDuration, octaveShift, tempoMap, measureGridUs, metronomeBeatGrid, bookmarks, keySignatures, needsTrackConfiguration: needsManualAssignment && tracks.some(track => !isTrackRoleComplete(track)), durationUs: duration })
      restoreSavedTrackSettings(song.id, this.session)
      resetBackgroundScores(this.session)
      this.refreshKeyboardRange()
      this.stats = null
      this.completedStatsBatch = []
      this.performanceAutoPlay = false
      this.performanceAutoPlayUsed = false
      this.playbackManuallyStopped = false
      this.playbackRunning = false
      this.unblockPlaybackOutput(true)
      this.resetLoopAttemptHistory()
      this.restoreSavedLoopRegion(song.id)
      restoreSavedFingering(song.id, this.session)
      this.clock?.stop()
      this.metronome.restart()
      this.clock = new MidiPlayerClock(duration, () => this.session?.speed ?? 100, state => {
        const session = this.session
        if (!session || !session.setupComplete || this.stats) return
        const tickProfile = beginSimulationTick({ currentUs: state.currentUs, progressRatio: state.progress, notesTotal: session.notes.length })
        try {
          const settings = useSettingsStore()
          this.currentProgress = state.progress
          this.playbackRunning = state.running && !state.finished
          setPlaybackGauge(tickProfile, 'progressRatio', state.progress)
          setPlaybackGauge(tickProfile, 'waitingNotes', countWaitingNotes(session))
          setPlaybackGauge(tickProfile, 'activeHolds', Object.keys(session.score.activeHolds).length)
          setPlaybackGauge(tickProfile, 'activeInputNotes', session.activeNotes.size)
          setPlaybackGauge(tickProfile, 'activeAutoNotes', session.autoActiveNotes.size)
          setPlaybackGauge(tickProfile, 'scoreOutcomeCount', Object.keys(session.score.noteOutcomes).length)
          if (state.looped) {
            measurePlaybackSpan(tickProfile, 'tick.loopReset', () => {
              this.finalizeLoopAttempt(session)
              this.resetSessionForSeek(state.currentUs)
              this.metronome.reset(state.currentUs)
            })
            addPlaybackCounter(tickProfile, 'loopedThisTick')
          }
          const nowMs = performance.now()
          const activeWaitNote = measurePlaybackSpan(tickProfile, 'tick.activeWaitLookup', () => {
            if (!session.melodyWaitNoteId) return undefined
            let scanned = 0
            for (const note of session.notes) {
              scanned += 1
              if (note.id === session.melodyWaitNoteId) {
                addPlaybackCounter(tickProfile, 'activeWaitScanned', scanned)
                return note
              }
            }
            addPlaybackCounter(tickProfile, 'activeWaitScanned', scanned)
            return undefined
          })
          if (activeWaitNote && this.performanceAutoPlay) {
            measurePlaybackSpan(tickProfile, 'tick.performanceAutoPlay', () => this.runPerformanceAutoPlay(session, Math.max(state.currentUs, activeWaitNote.start), nowMs))
          }
          if (activeWaitNote && activeWaitNote.state === 'waiting') {
            session.currentUs = activeWaitNote.start
            session.finished = false
            session.paused = true
            for (const score of activeScoresFor(session)) resetSpeedTrackingAnchor(score, activeWaitNote.start, nowMs)
            return
          }

          if (this.performanceAutoPlay) {
            measurePlaybackSpan(tickProfile, 'tick.performanceAutoPlay', () => this.runPerformanceAutoPlay(session, state.currentUs, nowMs))
          }

          if (session.mode === 'noteMemory' && !this.performanceAutoPlay) {
            const waitNote = measurePlaybackSpan(tickProfile, 'tick.noteMemoryWaitLookup', () => {
              let scanned = 0
              for (const note of session.notes) {
                scanned += 1
                if (
                  isPlayableNote(note, session.tracks, session.handSelection, session) &&
                  note.state === 'waiting' &&
                  note.start <= state.currentUs
                ) {
                  addPlaybackCounter(tickProfile, 'noteMemoryWaitScanned', scanned)
                  addPlaybackCounter(tickProfile, 'noteMemoryWaitFound')
                  return note
                }
              }
              addPlaybackCounter(tickProfile, 'noteMemoryWaitScanned', scanned)
              return undefined
            })
            if (waitNote) {
              session.melodyWaitNoteId = waitNote.id
              session.melodyWaitStartedMs = nowMs
              markKeyboardVisualChanged(session)
              session.currentUs = waitNote.start
              session.finished = false
              session.paused = true
              this.autoPlayer.allNotesOff(session)
              for (const score of activeScoresFor(session)) resetSpeedTrackingAnchor(score, waitNote.start, nowMs)
              this.clock?.pause()
              this.clock?.seek(waitNote.start)
              return
            }
          }

          measurePlaybackSpan(tickProfile, 'tick.speedTracking', () => {
            for (const score of activeScoresFor(session)) {
              if (state.running) updateSpeedTracking(score, state.currentUs, nowMs)
              else resetSpeedTrackingAnchor(score, state.currentUs, nowMs)
            }
          })
          session.currentUs = state.currentUs
          session.finished = state.finished
          if (this.playbackOutputBlocked) {
            measurePlaybackSpan(tickProfile, 'tick.outputBlocked', () => {
              this.autoPlayer.allNotesOff(session)
              this.metronome.reset(state.currentUs)
            })
          } else {
            measurePlaybackSpan(tickProfile, 'tick.autoPlayer', () => this.autoPlayer.tick(session))
            measurePlaybackSpan(tickProfile, 'tick.metronome', () => this.metronome.tick(session.metronomeBeatGrid, state.currentUs, {
              volume: settings.metronomeVolume,
              doubleSpeed: settings.metronomeDoubleSpeed,
              emphasizeFirstBeat: settings.metronomeEmphasizeFirstBeat,
            }))
          }
          const misses = measurePlaybackSpan(tickProfile, 'tick.markMisses', () => markMisses(session.notes, session.tracks, session.handSelection, state.currentUs, session))
          addPlaybackCounter(tickProfile, 'missesThisTick', misses.length)
          if (session.modeConfig.scoringEnabled) {
            measurePlaybackSpan(tickProfile, 'tick.recordMisses', () => recordMissesForSessionNotes(session, misses))
            measurePlaybackSpan(tickProfile, 'tick.awardHoldPoints', () => {
              for (const score of activeScoresFor(session)) awardHoldPoints(score, state.currentUs, session.mode)
            })
            measurePlaybackSpan(tickProfile, 'tick.loopErrorLimit', () => this.restartLoopIfErrorLimitExceeded(session))
          }
          if (state.finished) {
            addPlaybackCounter(tickProfile, 'finishedThisTick')
            measurePlaybackSpan(tickProfile, 'tick.finishSession', () => this.finishSession())
          }
        } finally {
          endSimulationTick(tickProfile)
        }
      })
      this.applyLoopBoundsToClock()
    },
    configureSession(options: ConfigureSessionOptions) {
      const session = this.session
      if (!session) return
      const configureStartMs = performance.now()
      this.clock?.stop()
      this.autoPlayer.allNotesOff(session)
      this.metronome.restart()
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
      resetBackgroundScores(session)
      clearActiveNoteMetadata(session)
      session.notes = session.notes.map(n => ({ ...n, state: 'waiting' }))
      session.tracks.forEach(track => { track.mode = resolveTrackModeForSession(track, options.mode) })
      this.refreshKeyboardRange()
      this.stats = null
      this.completedStatsBatch = []
      this.performanceAutoPlay = false
      this.performanceAutoPlayUsed = false
      this.playbackManuallyStopped = false
      this.playbackRunning = false
      this.unblockPlaybackOutput(true)
      this.resetLoopAttemptHistory()
      this.applyLoopBoundsToClock()
      recordPlaybackEvent('configure', { durationMs: performance.now() - configureStartMs, notesTouched: session.notes.length, currentUs: session.currentUs })
    },
    async prepareAudio(outputId: string) {
      await this.autoPlayer.configure(outputId)
      await this.inputSynth.start()
    },
    start() {
      if (!this.session?.setupComplete || this.stats) return
      this.stopTrackPreview()
      this.playbackManuallyStopped = false
      this.playbackRunning = true
      this.clock?.start()
      this.session.paused = false
    },
    togglePause() {
      const session = this.session
      if (!session?.setupComplete || !session.modeConfig.pauseAllowed || this.stats) return
      this.clock?.toggle()
      session.paused = !this.clock?.state.running
      this.playbackRunning = !!this.clock?.state.running
      if (!session.paused) this.playbackManuallyStopped = false
      if (session.paused) this.autoPlayer.allNotesOff(session)
    },
    stopPlayback() {
      const session = this.session
      if (!session || this.stats) return
      this.clock?.pause()
      session.paused = true
      this.playbackManuallyStopped = true
      this.playbackRunning = false
      this.currentProgress = this.clock?.state.progress ?? this.currentProgress
      session.currentUs = this.clock?.state.currentUs ?? session.currentUs
      this.autoPlayer.allNotesOff(session)
    },
    blockPlaybackOutput() {
      this.playbackOutputBlockCount += 1
      this.playbackOutputBlocked = true
      this.autoPlayer.allNotesOff(this.session)
      this.inputSynth.allNotesOff()
      if (this.session) {
        this.session.activeNotes.clear()
        this.session.activeNoteHands.clear()
        this.session.activeNoteTrackIds.clear()
        this.session.activeNotePressCounts.clear()
        markKeyboardVisualChanged(this.session)
      }
    },
    unblockPlaybackOutput(force = false) {
      this.playbackOutputBlockCount = force ? 0 : Math.max(0, this.playbackOutputBlockCount - 1)
      this.playbackOutputBlocked = this.playbackOutputBlockCount > 0
      if (!this.playbackOutputBlocked) this.metronome.reset(this.session?.currentUs ?? 0)
    },
    withPlaybackOutputBlocked<T>(action: () => T): T {
      const wasBlocked = this.playbackOutputBlocked
      this.playbackOutputBlocked = true
      this.autoPlayer.allNotesOff(this.session)
      this.inputSynth.allNotesOff()
      try {
        return action()
      } finally {
        this.playbackOutputBlocked = wasBlocked || this.playbackOutputBlockCount > 0
      }
    },
    setSpeed(v: number) {
      const session = this.session
      if (!session || !session.modeConfig.speedChangeAllowed) return
      session.speed = clampSpeed(v)
      this.clock?.setSpeed()
    },
    setPerformanceAutoPlay(enabled: boolean) {
      this.performanceAutoPlay = enabled
      if (enabled) this.performanceAutoPlayUsed = true
      if (enabled && this.session) {
        this.runPerformanceAutoPlay(this.session, this.session.currentUs, performance.now())
      }
    },
    runPerformanceAutoPlay(session: PlaySession, currentUs: number, nowMs: number) {
      if (!this.performanceAutoPlay || session.mode === 'listen' || !session.modeConfig.scoringEnabled) return
      const notes = playableAutoTestNotes(session, currentUs)
      addActivePlaybackCounter('simulation', 'performanceAutoPlayNotes', notes.length)
      if (!notes.length) return
      const chordStart = Math.min(...notes.map(note => note.start))
      const chordNotes = notes.filter(note => Math.abs(note.start - chordStart) <= 2_000)
      for (const note of chordNotes) {
        this.pressNoteForPerformanceAutoPlay(session, note, currentUs)
      }
    },
    pressNoteForPerformanceAutoPlay(session: PlaySession, note: SessionNote, currentUs: number) {
      if (note.state !== 'waiting') return
      const inputNoteId = note.noteId + session.octaveShift * 12
      if (session.activeNotes.has(inputNoteId)) return
      this.noteInput(inputNoteId, true)
      const speedFactor = Math.max(0.01, session.speed / 100)
      const holdSongUs = Math.max(80_000, note.end - Math.max(currentUs, note.start))
      const releaseDelayMs = Math.max(80, Math.min(15_000, holdSongUs / 1000 / speedFactor))
      window.setTimeout(() => {
        if (this.session !== session) return
        this.noteInput(inputNoteId, false)
      }, releaseDelayMs)
    },
    seekToProgress(ratio: number) {
      const durationUs = this.clock?.seekableDurationUs ?? 0
      const seekableStartUs = -SEEK_PRE_ROLL_US
      this.seekToUs(seekableStartUs + Math.max(0, Math.min(1, ratio)) * (durationUs - seekableStartUs))
    },
    seekToUs(targetUs: number) {
      const session = this.session
      const clock = this.clock
      if (!session || !clock || !this.canSeek) return
      const seekStartMs = performance.now()
      const seekableStartUs = -SEEK_PRE_ROLL_US
      const seekUs = Math.max(seekableStartUs, Math.min(clock.seekableDurationUs, targetUs))
      this.recordSkippedPlayableNotes(seekUs)
      this.resetSessionForSeek(seekUs)
      this.withPlaybackOutputBlocked(() => clock.seek(seekUs))
      this.metronome.reset(Math.max(0, seekUs))
      session.paused = !clock.state.running
      recordPlaybackEvent('seek', { durationMs: performance.now() - seekStartMs, currentUs: seekUs, notesTouched: session.notes.length })
    },
    recordSkippedPlayableNotes(seekUs: number) {
      const session = this.session
      if (!session?.modeConfig.scoringEnabled || session.mode === 'noteMemory') return
      const skippedStartMs = performance.now()
      let touched = 0
      let missed = 0
      const fromUs = Math.max(0, session.currentUs)
      const toUs = Math.max(0, seekUs)
      if (toUs <= fromUs) return
      for (const note of session.notes) {
        touched += 1
        if (
          note.state === 'waiting' &&
          note.start >= fromUs &&
          note.start < toUs &&
          isPlayableNote(note, session.tracks, session.handSelection, session)
        ) {
          note.state = 'missed'
          recordMissForSessionNote(session, note)
          missed += 1
        }
      }
      recordPlaybackEvent('recordSkippedPlayableNotes', { durationMs: performance.now() - skippedStartMs, currentUs: seekUs, notesTouched: touched, missed })
    },
    resetSessionForSeek(seekUs: number) {
      const session = this.session
      if (!session) return
      const resetStartMs = performance.now()
      this.autoPlayer.allNotesOff(session)
      clearActiveNoteMetadata(session)
      session.failed = false
      session.failureReason = undefined
      session.melodyWaitNoteId = undefined
      session.melodyWaitStartedMs = undefined
      session.finished = false
      this.stats = null
      this.completedStatsBatch = []
      if (session.modeConfig.scoringEnabled) {
        for (const score of activeScoresFor(session)) trimScoreAfter(score, seekUs)
      }
      session.keyboardVisualVersion += 1
      session.notes = session.notes.map(note => {
        const outcome = session.score.noteOutcomes[note.id]
        let state: typeof note.state = outcome?.status ?? 'waiting'
        if (!outcome && isPlayableNote(note, session.tracks, session.handSelection, session) && note.start + HIT_WINDOW_US < seekUs) state = 'done'
        if (note.start >= seekUs) state = 'waiting'
        return { ...note, state }
      })
      for (const score of activeScoresFor(session)) resetSpeedTrackingAnchor(score, seekUs, performance.now())
      recordPlaybackEvent('resetSessionForSeek', {
        durationMs: performance.now() - resetStartMs,
        currentUs: seekUs,
        notesTouched: session.notes.length,
        scoreOutcomeCount: Object.keys(session.score.noteOutcomes).length,
        errorEventCount: session.score.errorEvents.length,
      })
    },
    setShowDuration(v: number) { if (this.session) this.session.showDuration = clampShowDuration(v) },
    addUserBookmark(timeUs: number, label?: string) {
      const session = this.session
      if (!session) return
      const id = `user:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
      const finalLabel = label || `Bookmark ${session.userBookmarks.length + 1}`
      session.userBookmarks.push({ id, timeUs, label: finalLabel })
      session.userBookmarks.sort((a, b) => a.timeUs - b.timeUs)
    },
    removeUserBookmark(id: string) {
      const session = this.session
      if (!session) return
      const index = session.userBookmarks.findIndex(b => b.id === id)
      if (index !== -1) session.userBookmarks.splice(index, 1)
    },
    clearUserBookmarks() {
      const session = this.session
      if (!session) return
      session.userBookmarks.splice(0, session.userBookmarks.length)
    },
    updateUserBookmarkLabel(id: string, label: string) {
      const session = this.session
      if (!session) return
      const bookmark = session.userBookmarks.find(b => b.id === id)
      if (bookmark) bookmark.label = label
    },
    seekToUserBookmark(id: string) {
      const session = this.session
      if (!session) return
      const bookmark = session.userBookmarks.find(b => b.id === id)
      if (bookmark) this.seekToUs(bookmark.timeUs)
    },
    seekToPreviousBookmark() {
      const session = this.session
      if (!session || !this.canSeek) return
      const currentUs = Math.max(0, session.currentUs)
      const points = getBookmarkSeekPoints(session)
      const previous = [...points].reverse().find(timeUs => timeUs < currentUs - BOOKMARK_SEEK_EPSILON_US)
      this.seekToUs(previous ?? points[0])
    },
    seekToNextBookmark() {
      const session = this.session
      if (!session || !this.canSeek) return
      const currentUs = Math.max(0, session.currentUs)
      const points = getBookmarkSeekPoints(session)
      const next = points.find(timeUs => timeUs > currentUs + BOOKMARK_SEEK_EPSILON_US)
      this.seekToUs(next ?? points[points.length - 1])
    },
    toggleLoop() {
      this.applyLoopBoundsToClock()
    },
    applyLoopBoundsToClock() {
      const session = this.session
      if (!session) return
      const configured = isLoopRegionConfigured(session.loopState)
      session.loopState.enabled = configured
      this.clock?.setLoopBounds(
        configured ? session.loopState.startUs : null,
        configured ? session.loopState.endUs : null,
        session.loopState.delayBetweenLoops * 1000
      )
    },
    restoreSavedLoopRegion(songId: string) {
      const session = this.session
      if (!session) return
      const saved = useProfileStore().loopRegionFor(songId)
      const durationUs = session.loopState.durationUs
      const restored = saved ? clampLoopRegion(saved.startUs, saved.endUs, durationUs) : { startUs: 0, endUs: 0 }
      const configured = isLoopRegionConfigured({ ...session.loopState, ...restored })
      session.loopState.startUs = configured ? restored.startUs : 0
      session.loopState.endUs = configured ? restored.endUs : 0
      this.applyLoopBoundsToClock()
      this.resetLoopAttemptHistory()
    },
    persistLoopRegion() {
      const session = this.session
      if (!session || !this.song) return
      useProfileStore().saveLoopRegion(this.song.id, session.loopState.startUs, session.loopState.endUs)
    },
    setLoopRegion(startUs: number, endUs: number) {
      const session = this.session
      if (!session) return
      const durationUs = session.loopState.durationUs
      const { startUs: validStart, endUs: validEnd } = clampLoopRegion(startUs, endUs, durationUs)
      if (validStart >= validEnd) return
      session.loopState.startUs = validStart
      session.loopState.endUs = validEnd
      this.applyLoopBoundsToClock()
      this.resetLoopAttemptHistory()
      this.persistLoopRegion()
    },
    clearLoopRegion() {
      const session = this.session
      if (!session) return
      session.loopState.startUs = 0
      session.loopState.endUs = 0
      this.applyLoopBoundsToClock()
      this.resetLoopAttemptHistory()
      this.persistLoopRegion()
    },
    setLoopDelay(seconds: number) {
      const session = this.session
      if (!session) return
      session.loopState.delayBetweenLoops = Math.max(0, Math.min(8, seconds))
      this.applyLoopBoundsToClock()
    },
    setLoopRestartAfterErrors(errors: number) {
      const session = this.session
      if (!session) return
      session.loopState.restartAfterErrors = Math.max(0, Math.min(30, Math.round(errors)))
    },
    snapToMeasure(timeUs: number): number {
      const session = this.session
      if (!session) return timeUs
      const grid = getLoopSnapGrid(session)
      let lo = 0
      let hi = grid.length - 1
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (grid[mid] < timeUs) lo = mid + 1
        else hi = mid
      }
      const after = grid[lo]
      const before = lo > 0 ? grid[lo - 1] : grid[0]
      return Math.abs(timeUs - before) <= Math.abs(timeUs - after) ? before : after
    },
    findNextMeasure(timeUs: number): number {
      const session = this.session
      if (!session) return timeUs
      for (const measure of getLoopSnapGrid(session)) {
        if (measure > timeUs) return measure
      }
      return session.loopState.durationUs
    },
    findPrevMeasure(timeUs: number): number {
      const session = this.session
      if (!session) return timeUs
      const grid = getLoopSnapGrid(session)
      for (let i = grid.length - 1; i >= 0; i--) {
        if (grid[i] < timeUs) return grid[i]
      }
      return 0
    },
    shiftLoopStart(direction: -1 | 1) {
      const session = this.session
      if (!session) return
      const loop = session.loopState
      if (!isLoopRegionConfigured(loop)) return
      let currentUs = loop.startUs
      const snapped = this.snapToMeasure(currentUs)
      const threshold = 1000
      if (Math.abs(snapped - currentUs) > threshold) {
        currentUs = direction === -1 ? this.findPrevMeasure(currentUs) : this.findNextMeasure(currentUs)
      } else {
        currentUs = direction === -1 ? this.findPrevMeasure(snapped - threshold) : this.findNextMeasure(snapped + threshold)
      }
      if (currentUs < 0) currentUs = 0
      if (currentUs >= loop.endUs) return
      this.setLoopRegion(currentUs, loop.endUs)
    },
    shiftLoopEnd(direction: -1 | 1) {
      const session = this.session
      if (!session) return
      const loop = session.loopState
      if (!isLoopRegionConfigured(loop)) return
      const durationUs = loop.durationUs
      let currentUs = loop.endUs
      const snapped = this.snapToMeasure(currentUs)
      const threshold = 1000
      if (Math.abs(snapped - currentUs) > threshold) {
        currentUs = direction === -1 ? this.findPrevMeasure(currentUs) : this.findNextMeasure(currentUs)
      } else {
        currentUs = direction === -1 ? this.findPrevMeasure(snapped - threshold) : this.findNextMeasure(snapped + threshold)
      }
      if (currentUs > durationUs) currentUs = durationUs
      if (currentUs <= loop.startUs) return
      this.setLoopRegion(loop.startUs, currentUs)
    },
    shiftEntireLoop(direction: -1 | 1) {
      const session = this.session
      if (!session) return
      const loop = session.loopState
      if (!isLoopRegionConfigured(loop)) return
      const durationUs = loop.durationUs
      let shiftUs: number
      const threshold = 1000
      if (direction === -1) {
        const prevMeasure = this.findPrevMeasure(loop.startUs - threshold)
        const snappedStart = this.snapToMeasure(loop.startUs)
        shiftUs = prevMeasure - snappedStart
        if (loop.startUs + shiftUs < 0) return
      } else {
        const nextMeasure = this.findNextMeasure(loop.endUs + threshold)
        const snappedEnd = this.snapToMeasure(loop.endUs)
        shiftUs = nextMeasure - snappedEnd
        if (loop.endUs + shiftUs > durationUs) return
      }
      this.setLoopRegion(loop.startUs + shiftUs, loop.endUs + shiftUs)
    },
    resetLoopAttemptHistory() {
      this.loopAttemptHistory = []
      this.loopAttemptCounter = 0
    },
    restartLoopIfErrorLimitExceeded(session: PlaySession) {
      const loop = session.loopState
      if (!isLoopRegionConfigured(loop) || loop.restartAfterErrors <= 0) return
      const currentUs = Math.max(0, session.currentUs)
      if (currentUs < loop.startUs || currentUs >= loop.endUs) return
      const summary = summarizeScoreWithinRange(session.score, loop.startUs, loop.endUs)
      if (summary.errorCount <= loop.restartAfterErrors) return
      this.resetSessionForSeek(loop.startUs)
      this.clock?.seek(loop.startUs)
      this.metronome.reset(loop.startUs)
    },
    countPlayableNotesInLoop(session: PlaySession) {
      const loop = session.loopState
      if (!isLoopRegionConfigured(loop)) return 0
      let total = 0
      for (const note of session.notes) {
        if (note.start >= loop.startUs && note.start < loop.endUs && isPlayableNote(note, session.tracks, session.handSelection, session)) total += 1
      }
      return total
    },
    finalizeLoopAttempt(session: PlaySession) {
      const loop = session.loopState
      if (!session.modeConfig.scoringEnabled || !isLoopRegionConfigured(loop)) return
      const totalNotes = this.countPlayableNotesInLoop(session)
      const summary = summarizeScoreWithinRange(session.score, loop.startUs, loop.endUs)
      this.loopAttemptCounter += 1
      this.loopAttemptHistory.push({
        id: `loop:${this.loopAttemptCounter}`,
        loopIndex: this.loopAttemptCounter,
        score: summary.score,
        errorCount: summary.errorCount,
        totalNotes,
        startedAtUs: loop.startUs,
        endedAtUs: loop.endUs,
        completedAt: Date.now(),
      })
      if (this.loopAttemptHistory.length > 50) this.loopAttemptHistory.splice(0, this.loopAttemptHistory.length - 50)
    },
    setNoteFinger(noteId: string, finger: number | null, hand?: 'left' | 'right', source: 'manual' | 'auto' = 'manual') {
      const session = this.session
      if (!session) return
      session.notes = session.notes.map(note => {
        if (note.id !== noteId) return note
        const validFinger = finger && finger >= 1 && finger <= 5 ? finger : null
        return {
          ...note,
          hand: hand ?? note.hand,
          finger: validFinger,
          fingerSource: validFinger ? source : undefined,
          fingerCost: validFinger ? note.fingerCost : undefined,
        }
      })
      markFingeringChanged(session)
      persistSessionFingering(this.song?.id, session)
    },
    clearAllFingers() {
      const session = this.session
      if (!session) return
      session.notes = session.notes.map(note => ({
        ...note,
        finger: null,
        fingerSource: undefined,
        fingerCost: undefined,
      }))
      markFingeringChanged(session)
      persistSessionFingering(this.song?.id, session)
    },
    async autoAssignFingers(handSize: HandSizePreset = 'M') {
      const session = this.session
      if (!session) return
      this.fingeringGenerating = true
      this.fingeringError = null
      try {
        const result = await requestPianoFingering(session.notes.map(note => ({
          id: note.id,
          start: note.start,
          end: note.end,
          noteId: note.noteId,
          hand: note.hand,
          finger: toFingerNumber(note.finger),
          fingerSource: note.fingerSource,
        })), { hand: 'both', handSize })
        applyFingeringAssignments(session, result.assignments)
        persistSessionFingering(this.song?.id, session, result.handSize)
      } catch (error) {
        this.fingeringError = error instanceof Error ? error.message : String(error)
      } finally {
        this.fingeringGenerating = false
      }
    },
    setTrackMode(trackId: number, mode: TrackMode) {
      const session = this.session
      if (!session || !updateTrack(session, trackId, track => { track.mode = mode })) return
      markKeyboardVisualChanged(session)
      persistSessionTrackSettings(this.song?.id, session)
    },
    setTrackColor(trackId: number, color: string) {
      const session = this.session
      if (!session || !updateTrack(session, trackId, track => { track.color = color })) return
      markKeyboardVisualChanged(session)
      persistSessionTrackSettings(this.song?.id, session)
    },
    setTrackInstrument(trackId: number, program: number) {
      const session = this.session
      if (!session || !updateTrack(session, trackId, track => { track.instrumentProgram = program })) return
      persistSessionTrackSettings(this.song?.id, session)
    },
    setTrackRole(trackId: number, role: TrackRole) {
      const session = this.session
      if (!session) return
      if (this.song?.id) {
        useProfileStore().assignLegacyScoresToTrackSelection(this.song.id, session.tracks.map(track => ({
          trackId: track.trackId,
          mode: track.mode,
          color: track.color,
          hitColor: track.hitColor,
          blackColor: track.blackColor,
          handAssignment: track.handAssignment,
          role: track.role,
          instrumentProgram: track.instrumentProgram,
        })))
      }
      const track = session.tracks.find(t => t.trackId === trackId)
      if (!track) return
      track.role = role
      track.handAssignment = roleToHandAssignment(role)
      if (role === 'left' || role === 'right') track.color = TRACK_ROLE_COLORS[role]
      track.mode = resolveTrackModeForSession(track, session.mode)
      applyTrackRoleToNotes(session, trackId, role)
      markKeyboardVisualChanged(session)
      this.refreshKeyboardRange()
      session.needsTrackConfiguration = session.tracks.some(t => !isTrackRoleComplete(t))
      persistSessionTrackSettings(this.song?.id, session)
    },
    setTrackHandAssignment(trackId: number, hand: 'left' | 'right' | undefined) {
      const session = this.session
      if (!session) return
      if (this.song?.id) {
        useProfileStore().assignLegacyScoresToTrackSelection(this.song.id, session.tracks.map(track => ({
          trackId: track.trackId,
          mode: track.mode,
          color: track.color,
          hitColor: track.hitColor,
          blackColor: track.blackColor,
          handAssignment: track.handAssignment,
          role: track.role,
          instrumentProgram: track.instrumentProgram,
        })))
      }
      const track = session.tracks.find(t => t.trackId === trackId)
      if (!track) return
      track.handAssignment = hand
      track.role = hand
      track.mode = resolveTrackModeForSession(track, session.mode)
      applyTrackRoleToNotes(session, trackId, track.role)
      markKeyboardVisualChanged(session)
      this.refreshKeyboardRange()
      session.needsTrackConfiguration = session.tracks.some(t => !isTrackRoleComplete(t))
      persistSessionTrackSettings(this.song?.id, session)
    },
    async startTrackPreview(trackId: number, outputId = '') {
      const session = this.session
      if (!session) return
      const track = session.tracks.find(t => t.trackId === trackId)
      const notes = session.notes.filter(note => note.trackId === trackId).map(note => ({ ...note, state: 'waiting' as const }))
      if (!track || !notes.length) return

      this.stopTrackPreview()
      await this.trackPreviewPlayer.configure(outputId)

      const firstStartUs = Math.min(...notes.map(note => note.start))
      const lastEndUs = Math.max(...notes.map(note => note.end))
      const previewTrack = { ...track, mode: 'playedAutomatically' as TrackMode }
      const previewSession = createPlaySession(notes, [previewTrack], {
        mode: 'listen',
        handSelection: 'both',
        speed: session.speed,
        showDuration: session.showDuration,
        octaveShift: session.octaveShift,
        durationUs: lastEndUs,
      })
      previewSession.mode = 'listen'
      previewSession.modeConfig = PLAY_MODE_CONFIGS.listen
      previewSession.setupComplete = true
      previewSession.paused = false
      previewSession.currentUs = firstStartUs

      this.trackPreviewSession = previewSession
      this.trackPreviewTrackId = trackId
      this.trackPreviewClock = new MidiPlayerClock(lastEndUs, () => this.session?.speed ?? 100, state => {
        const preview = this.trackPreviewSession
        if (!preview) return
        preview.currentUs = state.currentUs
        preview.finished = state.finished
        preview.paused = !state.running
        this.trackPreviewRunning = state.running && !state.finished
        this.trackPreviewPlayer.tick(preview)
        if (state.finished) this.stopTrackPreview()
      }, { leadInUs: 0, leadOutUs: 0 })
      this.trackPreviewClock.seek(firstStartUs)
      this.trackPreviewClock.start()
      this.trackPreviewRunning = true
    },
    stopTrackPreview() {
      this.trackPreviewClock?.stop()
      this.trackPreviewPlayer.allNotesOff(this.trackPreviewSession)
      this.trackPreviewClock = null
      this.trackPreviewSession = null
      this.trackPreviewTrackId = null
      this.trackPreviewRunning = false
    },
    async toggleTrackPreview(trackId: number, outputId = '') {
      if (this.trackPreviewTrackId === trackId && this.trackPreviewRunning) {
        this.stopTrackPreview()
        return
      }
      await this.startTrackPreview(trackId, outputId)
    },
    noteInput(noteId: number, on: boolean) {
      const session = this.session
      if (this.playbackOutputBlocked) return
      if (!session?.setupComplete || session.finished || this.stats) return
      if (!on) {
        session.activeNotes.delete(noteId)
        session.activeNoteHands.delete(noteId)
        session.activeNoteTrackIds.delete(noteId)
        markKeyboardVisualChanged(session)
        for (const score of activeScoresFor(session)) stopHoldsForInput(score, noteId)
        this.inputSynth.noteOff(noteId)
        return
      }

      const playableNoteId = noteId - session.octaveShift * 12
      const hit = session.mode === 'listen' ? null : findHit(session.notes, session.tracks, session.handSelection, playableNoteId, session.currentUs, session)
      session.activeNotePressCounts.set(noteId, (session.activeNotePressCounts.get(noteId) ?? 0) + 1)
      session.activeNotes.add(noteId)

      if (hit) {
        session.activeNoteHands.set(noteId, hit.hand)
        session.activeNoteTrackIds.set(noteId, hit.trackId)
      }
      markKeyboardVisualChanged(session)
      void this.inputSynth.noteOn(String(noteId), noteId, 80, getTrackSoundfont(session, hit?.trackId))
      if (session.mode === 'listen') return

      if (hit) {
        const chordStart = findEarliestPlayableWaitingStart(session.notes, session.tracks, session.handSelection, session)
        const chordNotes = chordStart === null
          ? [hit]
          : collectChordAtStart(session.notes, session.tracks, session.handSelection, chordStart, session)
        const activeInputByPlayableNote = new Map<number, number>()
        for (const activeNoteId of session.activeNotes) {
          activeInputByPlayableNote.set(activeNoteId - session.octaveShift * 12, activeNoteId)
        }
        const chordComplete = chordNotes.every(chordNote => activeInputByPlayableNote.has(chordNote.noteId))

        if (!chordComplete) return

        const nowMs = performance.now()
        for (const chordNote of chordNotes) {
          const inputNoteId = activeInputByPlayableNote.get(chordNote.noteId) ?? noteId
          session.activeNoteHands.set(inputNoteId, chordNote.hand)
          session.activeNoteTrackIds.set(inputNoteId, chordNote.trackId)
          chordNote.state = 'hit'
          if (session.modeConfig.scoringEnabled) recordHitForSessionNote(session, chordNote, session.currentUs, inputNoteId, nowMs)
        }
        if (session.mode === 'noteMemory' && chordNotes.some(note => note.id === session.melodyWaitNoteId)) {
          session.melodyWaitNoteId = undefined
          session.melodyWaitStartedMs = undefined
          markKeyboardVisualChanged(session)
          this.start()
        }
        return
      }

      if (session.mode === 'noteMemory') {
        recordStrayForTargets(session, session.currentUs, playableNoteId)
        return
      }
      if (session.modeConfig.scoringEnabled) recordStrayForTargets(session, session.currentUs, playableNoteId)
    },
    markFailed(reason: FailureReason, stop: boolean) {
      const session = this.session
      if (!session) return
      session.failed = true
      session.failureReason ??= reason
      if (!stop) return
      session.finished = true
      this.clock?.pause()
      this.autoPlayer.allNotesOff(session)
      const completed = summarizeCompletedStats(session)
      this.stats = completed.stats
      this.completedStatsBatch = completed.batch
    },
    finishSession() {
      const session = this.session
      if (!session || this.stats) return
      const finishStartMs = performance.now()
      session.finished = true
      session.paused = true
      this.autoPlayer.allNotesOff(session)
      const completed = summarizeCompletedStats(session)
      this.stats = completed.stats
      this.completedStatsBatch = completed.batch
      recordPlaybackEvent('finishSession', { durationMs: performance.now() - finishStartMs, currentUs: session.currentUs, notesTouched: session.notes.length })
    },
  },
})
