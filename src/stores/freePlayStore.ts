import { defineStore } from 'pinia'
import { get, persistQueue, put } from '../modules/storage/indexedDb'
import type { NoteInputEvent, NoteInputSource } from './playerStore'

export type FreePlayStatus = 'idle' | 'recording' | 'recorded'
export type FreePlayTimeSignature = 'disabled' | '2/4' | '3/4' | '4/4' | '5/4' | '6/4' | '3/8' | '4/8' | '5/8' | '6/8' | '7/8' | '8/8' | '9/8' | '10/8' | '11/8' | '12/8' | '2/2' | '3/2' | '4/2'

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
}

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

function clampBpm(value: number) {
  return Math.max(20, Math.min(300, Math.round(value)))
}

function clampMetronomeVolume(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 5) * 5))
}

function normalizeFreePlayPreferences(value?: Partial<FreePlayPreferences> | null): FreePlayPreferences {
  return {
    ...defaultFreePlayPreferences,
    ...value,
    bpm: clampBpm(value?.bpm ?? defaultFreePlayPreferences.bpm),
    timeSignature: value?.timeSignature && FREE_PLAY_TIME_SIGNATURE_SET.has(value.timeSignature) ? value.timeSignature : defaultFreePlayPreferences.timeSignature,
    metronomeVolume: clampMetronomeVolume(value?.metronomeVolume ?? defaultFreePlayPreferences.metronomeVolume),
    keySignature: value?.keySignature && FREE_PLAY_KEY_SIGNATURE_SET.has(value.keySignature) ? value.keySignature : defaultFreePlayPreferences.keySignature,
    keySignatureMode: value?.keySignatureMode === 'minor' ? 'minor' : 'major',
  }
}

export function parseFreePlayTimeSignature(value: FreePlayTimeSignature) {
  if (value === 'disabled') return { numerator: 4, denominator: 4, enabled: false }
  const [numerator, denominator] = value.split('/').map(Number)
  return { numerator, denominator, enabled: true }
}

export interface FreePlayRecordedNote {
  id: string
  noteId: number
  startUs: number
  endUs: number
  velocity: number
  source: NoteInputSource
}

interface ActiveCapture {
  noteId: number
  startUs: number
  velocity: number
  source: NoteInputSource
}

function nowUs(startMs: number) {
  return Math.max(0, Math.round((performance.now() - startMs) * 1000))
}

export const useFreePlayStore = defineStore('freePlay', {
  state: () => ({
    status: 'idle' as FreePlayStatus,
    recordStartMs: 0,
    recordStopMs: 0,
    notes: [] as FreePlayRecordedNote[],
    activeNotesByPitch: new Map<number, ActiveCapture[]>(),
    nextNoteId: 1,
    clockTick: 0,
    loading: false,
    initialized: false,
    ...defaultFreePlayPreferences,
  }),
  getters: {
    recordingDurationUs(state) {
      if (!state.recordStartMs) return 0
      if (state.status === 'recording') return Math.max(0, Math.round((performance.now() - state.recordStartMs) * 1000)) + state.clockTick * 0
      if (state.recordStopMs) return Math.max(0, Math.round((state.recordStopMs - state.recordStartMs) * 1000))
      return 0
    },
    hasRecording(state) {
      return state.status === 'recorded' && state.notes.length > 0
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
      }
      persistQueue.enqueue(() => put('app-state', { key: FREE_PLAY_SETTINGS_KEY, value: preferences }))
    },
    tickClock() {
      this.clockTick += 1
    },
    startRecording() {
      this.notes = []
      this.activeNotesByPitch.clear()
      this.recordStartMs = performance.now()
      this.recordStopMs = 0
      this.nextNoteId = 1
      this.status = 'recording'
      this.clockTick += 1
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
      this.status = this.notes.length ? 'recorded' : 'idle'
      this.clockTick += 1
    },
    clearRecording() {
      this.status = 'idle'
      this.recordStartMs = 0
      this.recordStopMs = 0
      this.notes = []
      this.activeNotesByPitch.clear()
      this.nextNoteId = 1
      this.clockTick += 1
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
      const atUs = nowUs(this.recordStartMs)
      const list = this.activeNotesByPitch.get(event.noteId) ?? []
      if (event.on) {
        list.push({ noteId: event.noteId, startUs: atUs, velocity: event.velocity, source: event.source })
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
      const safeEndUs = Math.max(capture.startUs + 10_000, endUs)
      this.notes.push({
        id: `free:${this.nextNoteId++}`,
        noteId: capture.noteId,
        startUs: capture.startUs,
        endUs: safeEndUs,
        velocity: capture.velocity,
        source: capture.source,
      })
    },
  },
})
