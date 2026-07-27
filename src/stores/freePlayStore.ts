import { defineStore } from 'pinia'
import { DEFAULT_INSTRUMENT_PROGRAM } from '../modules/audio/gmInstrumentCatalog'
import { TRACK_SETTINGS_PALETTE } from '../modules/game/trackProperties'
import { get, persistQueue, put } from '../modules/storage/indexedDb'
import type { NoteInputEvent, NoteInputSource } from './playerStore'

export type FreePlayStatus = 'idle' | 'recording' | 'recorded'
export type FreePlayTimeSignature = 'disabled' | '2/4' | '3/4' | '4/4' | '5/4' | '6/4' | '3/8' | '4/8' | '5/8' | '6/8' | '7/8' | '8/8' | '9/8' | '10/8' | '11/8' | '12/8' | '2/2' | '3/2' | '4/2'

const FREE_PLAY_KEY_SIGNATURE_DEFINITIONS = [
  { id: 'flat7', fileName: '7b_Cb_Abm.svg', nameKey: 'freePlay.keySignatureNames.flat7' },
  { id: 'flat6', fileName: '6b_Gb_Ebm.svg', nameKey: 'freePlay.keySignatureNames.flat6' },
  { id: 'flat5', fileName: '5b_Db_Bbm.svg', nameKey: 'freePlay.keySignatureNames.flat5' },
  { id: 'flat4', fileName: '4b_Ab_Fm.svg', nameKey: 'freePlay.keySignatureNames.flat4' },
  { id: 'flat3', fileName: '3b_Eb_Cm.svg', nameKey: 'freePlay.keySignatureNames.flat3' },
  { id: 'flat2', fileName: '2b_Bb_Gm.svg', nameKey: 'freePlay.keySignatureNames.flat2' },
  { id: 'flat1', fileName: '1b_F_Dm.svg', nameKey: 'freePlay.keySignatureNames.flat1' },
  { id: 'natural', fileName: '0_C_Am.svg', nameKey: 'freePlay.keySignatureNames.natural' },
  { id: 'sharp1', fileName: '1s_G_Em.svg', nameKey: 'freePlay.keySignatureNames.sharp1' },
  { id: 'sharp2', fileName: '2s_D_Bm.svg', nameKey: 'freePlay.keySignatureNames.sharp2' },
  { id: 'sharp3', fileName: '3s_A_Fsm.svg', nameKey: 'freePlay.keySignatureNames.sharp3' },
  { id: 'sharp4', fileName: '4s_E_Csm.svg', nameKey: 'freePlay.keySignatureNames.sharp4' },
  { id: 'sharp5', fileName: '5s_B_Gsm.svg', nameKey: 'freePlay.keySignatureNames.sharp5' },
  { id: 'sharp6', fileName: '6s_Fs_Dsm.svg', nameKey: 'freePlay.keySignatureNames.sharp6' },
  { id: 'sharp7', fileName: '7s_Cs_Asm.svg', nameKey: 'freePlay.keySignatureNames.sharp7' },
] as const

export type FreePlayKeySignature = (typeof FREE_PLAY_KEY_SIGNATURE_DEFINITIONS)[number]['id']
export type FreePlayKeySignatureMode = 'major' | 'minor'

export interface FreePlayRecordedNote {
  id: string
  trackId: number
  noteId: number
  startUs: number
  endUs: number
  velocity: number
  source: NoteInputSource
}

export interface FreePlayTrack {
  id: number
  instrumentProgram: number
  color: string
  loop: boolean
  notes: FreePlayRecordedNote[]
}

interface FreePlayPreferences {
  bpm: number
  timeSignature: FreePlayTimeSignature
  metronomeVolume: number
  metronomeDoubleSpeed: boolean
  metronomeEmphasizeFirstBeat: boolean
  showColorInstrument: boolean
  showRecordedTracks: boolean
  showChordName: boolean
  showKeySignature: boolean
  keySignature: FreePlayKeySignature
  keySignatureMode: FreePlayKeySignatureMode
  tracks: FreePlayTrack[]
  selectedTrackId: number
  nextTrackId: number
  nextNoteId: number
}

interface ActiveCapture {
  trackId: number
  noteId: number
  startUs: number
  velocity: number
  source: NoteInputSource
}

export const MAX_FREE_PLAY_TRACKS = 6
export const FREE_PLAY_DEFAULT_TRACK_COLOR = '#4e9a06'

export const FREE_PLAY_KEY_SIGNATURES = FREE_PLAY_KEY_SIGNATURE_DEFINITIONS.map(signature => ({
  ...signature,
  src: `/assets/${encodeURIComponent(signature.fileName)}`,
}))

export const FREE_PLAY_TIME_SIGNATURES: FreePlayTimeSignature[] = [
  'disabled',
  '2/4', '3/4', '4/4', '5/4', '6/4',
  '3/8', '4/8', '5/8', '6/8', '7/8', '8/8', '9/8', '10/8', '11/8', '12/8',
  '2/2', '3/2', '4/2',
]

const FREE_PLAY_SETTINGS_KEY = 'free-play-settings'
const FREE_PLAY_TIME_SIGNATURE_SET = new Set<FreePlayTimeSignature>(FREE_PLAY_TIME_SIGNATURES)
const FREE_PLAY_KEY_SIGNATURE_SET = new Set<FreePlayKeySignature>(FREE_PLAY_KEY_SIGNATURES.map(signature => signature.id))

function createDefaultTrack(id = 1): FreePlayTrack {
  return {
    id,
    instrumentProgram: DEFAULT_INSTRUMENT_PROGRAM,
    color: FREE_PLAY_DEFAULT_TRACK_COLOR,
    loop: false,
    notes: [],
  }
}

const defaultFreePlayPreferences: FreePlayPreferences = {
  bpm: 120,
  timeSignature: 'disabled',
  metronomeVolume: 100,
  metronomeDoubleSpeed: false,
  metronomeEmphasizeFirstBeat: true,
  showColorInstrument: true,
  showRecordedTracks: true,
  showChordName: true,
  showKeySignature: true,
  keySignature: 'natural',
  keySignatureMode: 'major',
  tracks: [createDefaultTrack()],
  selectedTrackId: 1,
  nextTrackId: 2,
  nextNoteId: 1,
}

function clampBpm(value: number) {
  return Math.max(20, Math.min(300, Math.round(value)))
}

function clampMetronomeVolume(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 5) * 5))
}

function normalizeProgram(value: number | undefined) {
  return Number.isInteger(value) && value != null && value >= 0 && value <= 127 ? value : DEFAULT_INSTRUMENT_PROGRAM
}

function normalizeColor(value: string | undefined, index: number) {
  return value || TRACK_SETTINGS_PALETTE[index % TRACK_SETTINGS_PALETTE.length] || FREE_PLAY_DEFAULT_TRACK_COLOR
}

const MIN_FREE_PLAY_NOTE_DURATION_US = 10_000

function clampMidiValue(value: number | undefined, fallback: number) {
  return Math.max(0, Math.min(127, Math.round(value ?? fallback)))
}

function normalizeRecordedNote(note: Partial<FreePlayRecordedNote>, trackId: number, fallbackId: string): FreePlayRecordedNote {
  const startUs = Math.max(0, Math.round(note.startUs ?? 0))
  const endUs = Math.max(startUs + MIN_FREE_PLAY_NOTE_DURATION_US, Math.round(note.endUs ?? startUs + MIN_FREE_PLAY_NOTE_DURATION_US))
  return {
    id: note.id || fallbackId,
    trackId,
    noteId: clampMidiValue(note.noteId, 60),
    startUs,
    endUs,
    velocity: clampMidiValue(note.velocity, 80),
    source: note.source ?? 'midi',
  }
}

function sortRecordedNotes(notes: FreePlayRecordedNote[]) {
  return notes.sort((left, right) => left.startUs - right.startUs || left.noteId - right.noteId || left.endUs - right.endUs)
}

function normalizeTrackNotes(notes: Partial<FreePlayRecordedNote>[], trackId: number) {
  return sortRecordedNotes(notes.map((note, noteIndex) => normalizeRecordedNote(note, trackId, `free:${trackId}:${noteIndex + 1}`)))
}

function normalizeTrack(value: Partial<FreePlayTrack> | null | undefined, index: number): FreePlayTrack {
  const id = Number.isInteger(value?.id) && value!.id! > 0 ? value!.id! : index + 1
  const notes = Array.isArray(value?.notes) ? value!.notes! : []
  return {
    id,
    instrumentProgram: normalizeProgram(value?.instrumentProgram),
    color: normalizeColor(value?.color, index),
    loop: !!value?.loop,
    notes: normalizeTrackNotes(notes, id),
  }
}

function normalizeTracks(value?: Partial<FreePlayTrack>[] | null): FreePlayTrack[] {
  const source = Array.isArray(value) ? value.slice(0, MAX_FREE_PLAY_TRACKS) : []
  const tracks = source.map(normalizeTrack)
  return tracks.length ? tracks : [createDefaultTrack()]
}

function normalizeFreePlayPreferences(value?: Partial<FreePlayPreferences> | null): FreePlayPreferences {
  const tracks = normalizeTracks(value?.tracks)
  const trackIds = new Set(tracks.map(track => track.id))
  const maxTrackId = Math.max(...tracks.map(track => track.id))
  const maxNoteId = Math.max(0, ...tracks.flatMap(track => track.notes.map(note => Number(note.id.split(':').pop()) || 0)))
  return {
    ...defaultFreePlayPreferences,
    ...value,
    bpm: clampBpm(value?.bpm ?? defaultFreePlayPreferences.bpm),
    timeSignature: value?.timeSignature && FREE_PLAY_TIME_SIGNATURE_SET.has(value.timeSignature) ? value.timeSignature : defaultFreePlayPreferences.timeSignature,
    metronomeVolume: clampMetronomeVolume(value?.metronomeVolume ?? defaultFreePlayPreferences.metronomeVolume),
    keySignature: value?.keySignature && FREE_PLAY_KEY_SIGNATURE_SET.has(value.keySignature) ? value.keySignature : defaultFreePlayPreferences.keySignature,
    keySignatureMode: value?.keySignatureMode === 'minor' ? 'minor' : 'major',
    tracks,
    selectedTrackId: value?.selectedTrackId && trackIds.has(value.selectedTrackId) ? value.selectedTrackId : tracks[0].id,
    nextTrackId: Math.max(value?.nextTrackId ?? 1, maxTrackId + 1),
    nextNoteId: Math.max(value?.nextNoteId ?? 1, maxNoteId + 1),
  }
}

export function parseFreePlayTimeSignature(value: FreePlayTimeSignature) {
  if (value === 'disabled') return { numerator: 4, denominator: 4, enabled: false }
  const [numerator, denominator] = value.split('/').map(Number)
  return { numerator, denominator, enabled: true }
}

export function getFreePlayMeasureUs(bpm: number, timeSignature: FreePlayTimeSignature) {
  const signature = parseFreePlayTimeSignature(timeSignature)
  const quarterBeatUs = 60_000_000 / clampBpm(bpm)
  const beatUs = quarterBeatUs * (4 / signature.denominator)
  return Math.max(1, Math.round(beatUs * signature.numerator))
}

export function getFreePlayTrackLoopDurationUs(track: Pick<FreePlayTrack, 'notes'>, bpm: number, timeSignature: FreePlayTimeSignature) {
  const lastEndUs = Math.max(0, ...track.notes.map(note => note.endUs))
  if (lastEndUs <= 0) return 0
  const measureUs = getFreePlayMeasureUs(bpm, timeSignature)
  return Math.max(measureUs, Math.ceil(lastEndUs / measureUs) * measureUs)
}

function nowUs(startMs: number) {
  return Math.max(0, Math.round((performance.now() - startMs) * 1000))
}

export const useFreePlayStore = defineStore('freePlay', {
  state: () => ({
    status: 'idle' as FreePlayStatus,
    recordStartMs: 0,
    recordStopMs: 0,
    activeNotesByPitch: new Map<number, ActiveCapture[]>(),
    recordingTrackId: null as number | null,
    clockTick: 0,
    trackVersion: 0,
    loading: false,
    initialized: false,
    ...defaultFreePlayPreferences,
  }),
  getters: {
    notes(state): FreePlayRecordedNote[] {
      return state.tracks.flatMap(track => track.notes)
    },
    selectedTrack(state): FreePlayTrack {
      return state.tracks.find(track => track.id === state.selectedTrackId) ?? state.tracks[0] ?? createDefaultTrack()
    },
    recordingDurationUs(state) {
      const notesEndUs = Math.max(0, ...state.tracks.map(track => getFreePlayTrackLoopDurationUs(track, state.bpm, state.timeSignature)))
      if (!state.recordStartMs) return notesEndUs
      if (state.status === 'recording') return Math.max(0, Math.round((performance.now() - state.recordStartMs) * 1000)) + state.clockTick * 0
      if (state.recordStopMs) return Math.max(notesEndUs, Math.round((state.recordStopMs - state.recordStartMs) * 1000))
      return notesEndUs
    },
    hasRecording(state) {
      return state.tracks.some(track => track.notes.length > 0)
    },
    selectedTrackHasNotes(state) {
      return (state.tracks.find(track => track.id === state.selectedTrackId)?.notes.length ?? 0) > 0
    },
    canAddTrack(state) {
      return state.tracks.length < MAX_FREE_PLAY_TRACKS
    },
    activeCaptures(state) {
      return [...state.activeNotesByPitch.values()].flat()
    },
  },
  actions: {
    async hydrate() {
      if (this.initialized) return
      this.loading = true
      try {
        const record = await get<{ key: string; value: Partial<FreePlayPreferences> }>('app-state', FREE_PLAY_SETTINGS_KEY)
        Object.assign(this.$state, normalizeFreePlayPreferences(record?.value), { initialized: true, loading: false })
      } catch (error) {
        console.error('[Free Play Store] Lỗi khi hydrate:', error)
        Object.assign(this.$state, { initialized: true, loading: false })
      }
    },
    persist() {
      const preferences: FreePlayPreferences = {
        bpm: this.bpm,
        timeSignature: this.timeSignature,
        metronomeVolume: this.metronomeVolume,
        metronomeDoubleSpeed: this.metronomeDoubleSpeed,
        metronomeEmphasizeFirstBeat: this.metronomeEmphasizeFirstBeat,
        showColorInstrument: this.showColorInstrument,
        showRecordedTracks: this.showRecordedTracks,
        showChordName: this.showChordName,
        showKeySignature: this.showKeySignature,
        keySignature: this.keySignature,
        keySignatureMode: this.keySignatureMode,
        tracks: this.tracks,
        selectedTrackId: this.selectedTrackId,
        nextTrackId: this.nextTrackId,
        nextNoteId: this.nextNoteId,
      }
      persistQueue.enqueue(() => put('app-state', { key: FREE_PLAY_SETTINGS_KEY, value: preferences }))
    },
    touchTracks() {
      this.trackVersion += 1
      this.clockTick += 1
    },
    tickClock() {
      this.clockTick += 1
    },
    addTrack() {
      if (!this.canAddTrack) return
      const track = createDefaultTrack(this.nextTrackId++)
      track.color = TRACK_SETTINGS_PALETTE[this.tracks.length % TRACK_SETTINGS_PALETTE.length] ?? FREE_PLAY_DEFAULT_TRACK_COLOR
      this.tracks.push(track)
      this.selectedTrackId = track.id
      this.touchTracks()
      this.persist()
    },
    selectTrack(trackId: number) {
      if (!this.tracks.some(track => track.id === trackId)) return
      this.selectedTrackId = trackId
      this.touchTracks()
      this.persist()
    },
    deleteTrack(trackId: number) {
      const index = this.tracks.findIndex(track => track.id === trackId)
      if (index === -1) return
      this.activeNotesByPitch.clear()
      if (this.tracks.length === 1) {
        const reset = createDefaultTrack(this.tracks[0].id)
        this.tracks.splice(0, 1, reset)
        this.selectedTrackId = reset.id
      } else {
        this.tracks.splice(index, 1)
        if (this.selectedTrackId === trackId) this.selectedTrackId = this.tracks[Math.max(0, index - 1)]?.id ?? this.tracks[0].id
      }
      this.status = this.hasRecording ? 'recorded' : 'idle'
      this.touchTracks()
      this.persist()
    },
    clearTrack(trackId: number) {
      const track = this.tracks.find(track => track.id === trackId)
      if (!track) return
      track.notes = []
      if (trackId === this.selectedTrackId) this.activeNotesByPitch.clear()
      this.status = this.hasRecording ? 'recorded' : 'idle'
      this.touchTracks()
      this.persist()
    },
    clearAllTrackNotes() {
      for (const track of this.tracks) track.notes = []
      this.status = 'idle'
      this.recordStartMs = 0
      this.recordStopMs = 0
      this.recordingTrackId = null
      this.activeNotesByPitch.clear()
      this.touchTracks()
      this.persist()
    },
    replaceTrackEditorNotes(nextTracks: Pick<FreePlayTrack, 'id' | 'notes'>[]) {
      const notesByTrackId = new Map(nextTracks.map(track => [track.id, track.notes]))
      const usedIds = new Set<string>()

      for (const track of this.tracks) {
        const nextNotes = notesByTrackId.get(track.id)
        if (!nextNotes) continue
        const normalizedNotes = normalizeTrackNotes(nextNotes, track.id).map(note => {
          const existingNote = this.tracks.some(sourceTrack => sourceTrack.notes.some(sourceNote => sourceNote.id === note.id))
          const shouldAllocateId = !existingNote || usedIds.has(note.id)
          const id = shouldAllocateId ? `free:${this.nextNoteId++}` : note.id
          usedIds.add(id)
          return { ...note, id }
        })
        track.notes = normalizedNotes
      }

      this.recordStartMs = 0
      this.recordStopMs = 0
      this.recordingTrackId = null
      this.activeNotesByPitch.clear()
      this.status = this.hasRecording ? 'recorded' : 'idle'
      this.touchTracks()
      this.persist()
    },
    toggleTrackLoop(trackId: number) {
      const track = this.tracks.find(track => track.id === trackId)
      if (!track) return
      track.loop = !track.loop
      this.touchTracks()
      this.persist()
    },
    setTrackInstrument(trackId: number, program: number) {
      const track = this.tracks.find(track => track.id === trackId)
      if (!track) return
      track.instrumentProgram = normalizeProgram(program)
      this.touchTracks()
      this.persist()
    },
    setTrackColor(trackId: number, color: string) {
      const track = this.tracks.find(track => track.id === trackId)
      if (!track) return
      track.color = color || FREE_PLAY_DEFAULT_TRACK_COLOR
      this.touchTracks()
      this.persist()
    },
    startRecording() {
      const track = this.selectedTrack
      this.recordingTrackId = track.id
      track.notes = []
      this.activeNotesByPitch.clear()
      this.recordStartMs = performance.now()
      this.recordStopMs = 0
      this.status = 'recording'
      this.touchTracks()
      this.persist()
    },
    stopRecording() {
      if (this.status !== 'recording') return
      const endUs = nowUs(this.recordStartMs)
      for (const captures of this.activeNotesByPitch.values()) {
        while (captures.length) {
          const capture = captures.pop()
          if (capture) this.commitNote(capture, endUs)
        }
      }
      this.activeNotesByPitch.clear()
      this.recordStopMs = performance.now()
      this.recordingTrackId = null
      this.status = this.hasRecording ? 'recorded' : 'idle'
      this.touchTracks()
      this.persist()
    },
    clearRecording() {
      this.clearAllTrackNotes()
    },
    setBpm(value: number) {
      this.bpm = clampBpm(value)
      this.persist()
    },
    increaseBpm() {
      this.setBpm(this.bpm + 10)
    },
    decreaseBpm() {
      this.setBpm(this.bpm - 10)
    },
    setTimeSignature(value: FreePlayTimeSignature) {
      this.timeSignature = value
      this.persist()
    },
    setMetronomeVolume(value: number) {
      this.metronomeVolume = clampMetronomeVolume(value)
      this.persist()
    },
    setMetronomeDoubleSpeed(enabled: boolean) {
      this.metronomeDoubleSpeed = enabled
      this.persist()
    },
    setMetronomeEmphasizeFirstBeat(enabled: boolean) {
      this.metronomeEmphasizeFirstBeat = enabled
      this.persist()
    },
    setShowColorInstrument(enabled: boolean) {
      this.showColorInstrument = enabled
      this.persist()
    },
    setShowRecordedTracks(enabled: boolean) {
      this.showRecordedTracks = enabled
      this.persist()
    },
    setShowChordName(enabled: boolean) {
      this.showChordName = enabled
      this.persist()
    },
    setShowKeySignature(enabled: boolean) {
      this.showKeySignature = enabled
      this.persist()
    },
    setKeySignature(value: FreePlayKeySignature) {
      this.keySignature = value
      this.persist()
    },
    setKeySignatureMode(value: FreePlayKeySignatureMode) {
      this.keySignatureMode = value
      this.persist()
    },
    handleNoteInput(event: NoteInputEvent) {
      if (this.status !== 'recording') return
      const track = this.tracks.find(track => track.id === this.recordingTrackId) ?? this.selectedTrack
      const atUs = nowUs(this.recordStartMs)
      const list = this.activeNotesByPitch.get(event.noteId) ?? []
      if (event.on) {
        list.push({ trackId: track.id, noteId: event.noteId, startUs: atUs, velocity: event.velocity, source: event.source })
        this.activeNotesByPitch.set(event.noteId, list)
        this.clockTick += 1
        return
      }

      const capture = list.pop()
      if (!list.length) this.activeNotesByPitch.delete(event.noteId)
      if (capture) this.commitNote(capture, atUs)
      this.clockTick += 1
    },
    commitNote(capture: ActiveCapture, endUs: number) {
      const track = this.tracks.find(track => track.id === capture.trackId)
      if (!track) return
      const safeEndUs = Math.max(capture.startUs + 10_000, endUs)
      track.notes.push({
        id: `free:${this.nextNoteId++}`,
        trackId: capture.trackId,
        noteId: capture.noteId,
        startUs: capture.startUs,
        endUs: safeEndUs,
        velocity: capture.velocity,
        source: capture.source,
      })
      this.touchTracks()
    },
  },
})
