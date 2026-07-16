import { defineStore } from 'pinia'
import type { SongMetadata } from '../types/song'
import { base64ToBuffer, loadSongData } from '../modules/library/songLibrary'
import { parseMidi } from '../modules/midi/midiParser'
import { translateNotes } from '../modules/midi/midiNoteTranslator'
import type { MidiBookmarkSource } from '../modules/midi/midiTypes'
import { buildTempoMap, pulseToMicroseconds } from '../modules/midi/midiTempo'
import { createDefaultTrackProperties, isTrackRoleComplete, resolveTrackModeForSession, roleToHandAssignment, TRACK_ROLE_COLORS, type TrackMode, type TrackRole } from '../modules/game/trackProperties'
import { PLAY_MODE_CONFIGS, clampShowDuration, clampSpeed, createPlaySession, type ConfigureSessionOptions, type FailureReason, type PlaySession, type SessionNote } from '../modules/game/playSession'
import { getKeyboardRange } from '../modules/render/keyboardRange'
import { getKeySignatureAccidentals } from '../modules/render/pianoLabels'
import { MidiPlayerClock } from '../modules/midi/midiPlayerClock'
import { collectChordAtStart, findEarliestPlayableWaitingStart, findHit, HIT_WINDOW_US, isPlayableNote, markMisses } from '../modules/game/hitDetection'
import { awardHoldPoints, createScoreState, recordHit, recordMiss, recordMisses, recordStray, recordWrong, resetSpeedTrackingAnchor, stopHoldsForInput, trimScoreAfter, updateSpeedTracking } from '../modules/game/scoring'
import { summarizeStats, type SongPlayStats } from '../modules/game/songStatistics'
import { assignHands } from '../modules/game/handAssignment'
import { AutoNotePlayer } from '../modules/audio/autoNotePlayer'
import { MetronomePlayer, type MetronomeBeat } from '../modules/audio/metronomePlayer'
import { SimpleSynth } from '../modules/audio/simpleSynth'
import { getInstrumentByProgram } from '../modules/audio/gmInstrumentCatalog'
import { useSettingsStore } from './settingsStore'
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
}

function clearActiveNoteMetadata(session: PlaySession) {
  session.activeNotes.clear()
  session.activeNoteHands.clear()
  session.activeNoteTrackIds.clear()
  session.autoActiveNotes.clear()
  session.autoActiveNoteHands.clear()
  session.autoActiveNoteTrackIds.clear()
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

const BOOKMARK_SEEK_EPSILON_US = 10_000
const FALLBACK_BOOKMARK_US = 1_000_000

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
  }),
  getters: {
    canSeek: state => !!state.session?.setupComplete && !state.stats && !state.session.finished && state.session.mode !== 'performance',
  },
  actions: {
    refreshKeyboardRange() {
      const session = this.session
      if (!session) return
      const settings = useSettingsStore()
      session.keyboardRange = getKeyboardRange(settings.keyboardRangeMode, session.notes)
    },
    async loadSong(song: SongMetadata, speed = 100, showDuration = 3.25, octaveShift = 0) {
      const data = song.data ?? await loadSongData(song.id)
      if (!data) throw new Error('Bài hát không có dữ liệu MIDI')
      const midi = parseMidi(base64ToBuffer(data))
      const { notes, needsManualAssignment } = assignHands(translateNotes(midi))
      const trackIds = [...new Set(notes.map(n => n.trackId))]
      const tracks = createDefaultTrackProperties(trackIds.map(trackId => {
        const info = midi.tracks.find(track => track.trackId === trackId)
        const trackNotes = notes.filter(note => note.trackId === trackId)
        const hands = [...new Set(trackNotes.map(note => note.hand).filter(hand => hand === 'left' || hand === 'right'))]
        const role = info?.isPercussion ? 'background' : hands.length === 1 ? hands[0] : undefined
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
      this.session = createPlaySession(notes, tracks, { speed, showDuration, octaveShift, measureGridUs, metronomeBeatGrid, bookmarks, keySignatures, needsTrackConfiguration: needsManualAssignment, durationUs: duration })
      this.refreshKeyboardRange()
      this.stats = null
      this.performanceAutoPlay = false
      this.performanceAutoPlayUsed = false
      this.clock?.stop()
      this.metronome.restart()
      this.clock = new MidiPlayerClock(duration, () => this.session?.speed ?? 100, state => {
        const session = this.session
        if (!session || !session.setupComplete || this.stats) return
        const tickProfile = beginSimulationTick({ currentUs: state.currentUs, progressRatio: state.progress, notesTotal: session.notes.length })
        try {
          const settings = useSettingsStore()
          this.currentProgress = state.progress
          setPlaybackGauge(tickProfile, 'progressRatio', state.progress)
          setPlaybackGauge(tickProfile, 'waitingNotes', countWaitingNotes(session))
          setPlaybackGauge(tickProfile, 'activeHolds', Object.keys(session.score.activeHolds).length)
          setPlaybackGauge(tickProfile, 'activeInputNotes', session.activeNotes.size)
          setPlaybackGauge(tickProfile, 'activeAutoNotes', session.autoActiveNotes.size)
          setPlaybackGauge(tickProfile, 'scoreOutcomeCount', Object.keys(session.score.noteOutcomes).length)
          if (state.looped) {
            measurePlaybackSpan(tickProfile, 'tick.loopReset', () => {
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
            resetSpeedTrackingAnchor(session.score, activeWaitNote.start, nowMs)
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
              session.currentUs = waitNote.start
              session.finished = false
              session.paused = true
              this.autoPlayer.allNotesOff(session)
              resetSpeedTrackingAnchor(session.score, waitNote.start, nowMs)
              this.clock?.pause()
              this.clock?.seek(waitNote.start)
              return
            }
          }

          measurePlaybackSpan(tickProfile, 'tick.speedTracking', () => {
            if (state.running) updateSpeedTracking(session.score, state.currentUs, nowMs)
            else resetSpeedTrackingAnchor(session.score, state.currentUs, nowMs)
          })
          session.currentUs = state.currentUs
          session.finished = state.finished
          measurePlaybackSpan(tickProfile, 'tick.autoPlayer', () => this.autoPlayer.tick(session))
          measurePlaybackSpan(tickProfile, 'tick.metronome', () => this.metronome.tick(session.metronomeBeatGrid, state.currentUs, {
            volume: settings.metronomeVolume,
            doubleSpeed: settings.metronomeDoubleSpeed,
            emphasizeFirstBeat: settings.metronomeEmphasizeFirstBeat,
          }))
          const misses = measurePlaybackSpan(tickProfile, 'tick.markMisses', () => markMisses(session.notes, session.tracks, session.handSelection, state.currentUs, session))
          addPlaybackCounter(tickProfile, 'missesThisTick', misses.length)
          if (session.modeConfig.scoringEnabled) {
            measurePlaybackSpan(tickProfile, 'tick.recordMisses', () => recordMisses(session.score, misses))
            measurePlaybackSpan(tickProfile, 'tick.awardHoldPoints', () => awardHoldPoints(session.score, state.currentUs, session.mode))
          }
          if (state.finished) {
            addPlaybackCounter(tickProfile, 'finishedThisTick')
            measurePlaybackSpan(tickProfile, 'tick.finishSession', () => this.finishSession())
          }
        } finally {
          endSimulationTick(tickProfile)
        }
      })
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
      clearActiveNoteMetadata(session)
      session.notes = session.notes.map(n => ({ ...n, state: 'waiting' }))
      session.tracks.forEach(track => { track.mode = resolveTrackModeForSession(track, options.mode) })
      this.refreshKeyboardRange()
      this.stats = null
      this.performanceAutoPlay = false
      this.performanceAutoPlayUsed = false
      recordPlaybackEvent('configure', { durationMs: performance.now() - configureStartMs, notesTouched: session.notes.length, currentUs: session.currentUs })
    },
    async prepareAudio(outputId: string) {
      await this.autoPlayer.configure(outputId)
      await this.inputSynth.start()
    },
    start() {
      if (!this.session?.setupComplete || this.stats) return
      this.stopTrackPreview()
      this.clock?.start()
      this.session.paused = false
    },
    togglePause() {
      const session = this.session
      if (!session?.setupComplete || !session.modeConfig.pauseAllowed || this.stats) return
      this.clock?.toggle()
      session.paused = !this.clock?.state.running
      if (session.paused) this.autoPlayer.allNotesOff(session)
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
      this.seekToUs(Math.max(0, Math.min(1, ratio)) * durationUs)
    },
    seekToUs(targetUs: number) {
      const session = this.session
      const clock = this.clock
      if (!session || !clock || !this.canSeek) return
      const seekStartMs = performance.now()
      const seekUs = Math.max(0, Math.min(clock.seekableDurationUs, targetUs))
      this.recordSkippedPlayableNotes(seekUs)
      this.resetSessionForSeek(seekUs)
      clock.seek(seekUs)
      this.metronome.reset(seekUs)
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
          recordMiss(session.score, note)
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
      if (session.modeConfig.scoringEnabled) trimScoreAfter(session.score, seekUs)
      session.notes = session.notes.map(note => {
        const outcome = session.score.noteOutcomes[note.id]
        let state: typeof note.state = outcome?.status ?? 'waiting'
        if (!outcome && isPlayableNote(note, session.tracks, session.handSelection, session) && note.start + HIT_WINDOW_US < seekUs) state = 'done'
        if (note.start >= seekUs) state = 'waiting'
        return { ...note, state }
      })
      resetSpeedTrackingAnchor(session.score, seekUs, performance.now())
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
      const session = this.session
      if (!session) return
      session.loopState.enabled = !session.loopState.enabled
      this.clock?.setLoopBounds(
        session.loopState.enabled ? session.loopState.startUs : null,
        session.loopState.enabled ? session.loopState.endUs : null,
        session.loopState.delayBetweenLoops * 1000
      )
    },
    setLoopRegion(startUs: number, endUs: number) {
      const session = this.session
      const clock = this.clock
      if (!session || !clock) return
      const durationUs = session.loopState.durationUs
      const validStart = Math.max(0, Math.min(durationUs, startUs))
      const validEnd = Math.max(0, Math.min(durationUs, endUs))
      if (validStart >= validEnd) return
      session.loopState.startUs = validStart
      session.loopState.endUs = validEnd
      if (session.loopState.enabled) {
        clock.setLoopBounds(validStart, validEnd, session.loopState.delayBetweenLoops * 1000)
      }
    },
    clearLoopRegion() {
      const session = this.session
      const clock = this.clock
      if (!session || !clock) return
      session.loopState.startUs = 0
      session.loopState.endUs = session.loopState.durationUs
      if (session.loopState.enabled) {
        clock.setLoopBounds(0, session.loopState.durationUs, session.loopState.delayBetweenLoops * 1000)
      }
    },
    setLoopDelay(seconds: number) {
      const session = this.session
      if (!session) return
      session.loopState.delayBetweenLoops = Math.max(0, Math.min(8, seconds))
      if (session.loopState.enabled) {
        this.clock?.setLoopBounds(session.loopState.startUs, session.loopState.endUs, session.loopState.delayBetweenLoops * 1000)
      }
    },
    setLoopRestartAfterErrors(seconds: number) {
      const session = this.session
      if (!session) return
      session.loopState.restartAfterErrors = Math.max(0, Math.min(30, seconds))
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
    setTrackMode(trackId: number, mode: TrackMode) { const track = this.session?.tracks.find(t => t.trackId === trackId); if (track) track.mode = mode },
    setTrackColor(trackId: number, color: string) {
      const track = this.session?.tracks.find(t => t.trackId === trackId)
      if (track) track.color = color
    },
    setTrackInstrument(trackId: number, program: number) {
      const track = this.session?.tracks.find(t => t.trackId === trackId)
      if (track) track.instrumentProgram = program
    },
    setTrackRole(trackId: number, role: TrackRole) {
      const session = this.session
      if (!session) return
      const track = session.tracks.find(t => t.trackId === trackId)
      if (!track) return
      track.role = role
      track.handAssignment = roleToHandAssignment(role)
      if (role === 'left' || role === 'right') track.color = TRACK_ROLE_COLORS[role]
      track.mode = resolveTrackModeForSession(track, session.mode)
      applyTrackRoleToNotes(session, trackId, role)
      this.refreshKeyboardRange()
      session.needsTrackConfiguration = session.tracks.some(t => !isTrackRoleComplete(t))
    },
    setTrackHandAssignment(trackId: number, hand: 'left' | 'right' | undefined) {
      const session = this.session
      if (!session) return
      const track = session.tracks.find(t => t.trackId === trackId)
      if (!track) return
      track.handAssignment = hand
      track.role = hand
      track.mode = resolveTrackModeForSession(track, session.mode)
      applyTrackRoleToNotes(session, trackId, track.role)
      this.refreshKeyboardRange()
      session.needsTrackConfiguration = session.tracks.some(t => !isTrackRoleComplete(t))
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
      if (!session?.setupComplete || session.finished || this.stats) return
      if (!on) {
        session.activeNotes.delete(noteId)
        session.activeNoteHands.delete(noteId)
        session.activeNoteTrackIds.delete(noteId)
        stopHoldsForInput(session.score, noteId)
        this.inputSynth.noteOff(noteId)
        return
      }

      const playableNoteId = noteId - session.octaveShift * 12
      const hit = session.mode === 'listen' ? null : findHit(session.notes, session.tracks, session.handSelection, playableNoteId, session.currentUs, session)
      session.activeNotes.add(noteId)

      if (hit) {
        session.activeNoteHands.set(noteId, hit.hand)
        session.activeNoteTrackIds.set(noteId, hit.trackId)
      }
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
          if (session.modeConfig.scoringEnabled) recordHit(session.score, chordNote, session.currentUs, inputNoteId, nowMs)
        }
        if (session.mode === 'noteMemory' && chordNotes.some(note => note.id === session.melodyWaitNoteId)) {
          session.melodyWaitNoteId = undefined
          session.melodyWaitStartedMs = undefined
          this.start()
        }
        return
      }

      if (session.mode === 'noteMemory') {
        recordStray(session.score, session.currentUs)
        return
      }
      if (session.modeConfig.scoringEnabled) recordStray(session.score, session.currentUs)
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
      this.stats = summarizeStats(session.score, session)
    },
    finishSession() {
      const session = this.session
      if (!session || this.stats) return
      const finishStartMs = performance.now()
      session.finished = true
      session.paused = true
      this.autoPlayer.allNotesOff(session)
      this.stats = summarizeStats(session.score, session)
      recordPlaybackEvent('finishSession', { durationMs: performance.now() - finishStartMs, currentUs: session.currentUs, notesTouched: session.notes.length })
    },
  },
})
