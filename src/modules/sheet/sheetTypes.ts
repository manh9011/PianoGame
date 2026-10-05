export type SheetGenerationStage = 'idle' | 'loading-pyodide' | 'installing-music21' | 'building-model' | 'converting' | 'rendering' | 'ready' | 'error'

export type SheetMessageValues = Record<string, string | number>

export type SheetProgressCode =
  | 'preparing'
  | 'preparingData'
  | 'loadingMidiData'
  | 'loadingMusicXmlData'
  | 'convertingMusicXmlToMidi'
  | 'loadingPyodide'
  | 'installingMusic21'
  | 'analyzingMidi'
  | 'convertingVoiceShards'
  | 'convertingVoiceShard'
  | 'renderingVerovio'
  | 'cacheReady'
  | 'ready'

export type SheetErrorCode =
  | 'missingMidiData'
  | 'invalidMusicXml'
  | 'musicXmlToMidiFailed'
  | 'missingGeneratedMidi'
  | 'generationFailed'
  | 'noVoices'
  | 'noVoiceShard'
  | 'noMusicXmlPart'
  | 'verovioLoadFailed'
  | 'verovioInitTimeout'
  | 'verovioUnavailable'

export interface SheetGenerationProgress {
  stage: SheetGenerationStage
  message: string
  code?: SheetProgressCode
  values?: SheetMessageValues
}

export class SheetMusicError extends Error {
  constructor(
    message: string,
    readonly code: SheetErrorCode,
    readonly values: SheetMessageValues = {},
  ) {
    super(message)
    this.name = 'SheetMusicError'
  }
}

export function toSheetMusicError(error: unknown, fallbackCode: SheetErrorCode = 'generationFailed') {
  if (error instanceof SheetMusicError) return error
  if (error instanceof Error) return new SheetMusicError(error.message, fallbackCode)
  return new SheetMusicError(String(error), fallbackCode)
}

export interface SheetMusicArtifact {
  cacheKey: string
  musicXml: string
  compressedMusicXmlData?: string
  warnings: string[]
  stats: {
    staffCount: number
    voiceCount: number
    noteCount: number
  }
}

export interface SheetTempoEvent {
  tick: number
  bpm: number
  microsecondsPerQuarter: number
}

export interface SheetTimeSignatureEvent {
  tick: number
  numerator: number
  denominator: number
}

export interface SheetKeySignatureEvent {
  tick: number
  key: string | number
  scale?: string
}

export interface SheetControlEvent {
  tick: number
  controller: number
  value: number
  channel: number
}

export interface SheetProgramEvent {
  tick: number
  program: number
  channel: number
}

export interface SheetPitchBendEvent {
  tick: number
  value: number
  channel: number
}

export interface SheetNoteEvent {
  sourceTrackIndex: number
  sourceNoteIndex: number
  channel: number
  pitch: number
  velocity: number
  startTick: number
  endTick: number
  notationStartTick: number
  notationEndTick: number
  staff: number
}

export interface SheetSourceTrack {
  index: number
  name: string
  channel: number
  instrument: {
    program: number
    name: string
    family: string
  }
  notes: SheetNoteEvent[]
  controls: SheetControlEvent[]
  programs: SheetProgramEvent[]
  pitchBends: SheetPitchBendEvent[]
}

export interface SheetSourceModel {
  ppq: number
  name: string
  durationTick: number
  tempos: SheetTempoEvent[]
  timeSignatures: SheetTimeSignatureEvent[]
  keySignatures: SheetKeySignatureEvent[]
  tracks: SheetSourceTrack[]
}

export interface SheetVoiceEvent {
  startTick: number
  endTick: number
  channel: number
  velocity: number
  pitches: number[]
  sourceTrackIndexes: number[]
}

export interface SheetVoicePlan {
  id: number
  staff: number
  clef: 'treble' | 'bass'
  name: string
  channel: number
  program: number
  events: SheetVoiceEvent[]
  controls: SheetControlEvent[]
  programs: SheetProgramEvent[]
  pitchBends: SheetPitchBendEvent[]
}

export interface SheetShard {
  id: string
  staff: number
  voice: number
  clef: 'treble' | 'bass'
  name: string
  midiBytes: Uint8Array
  eventCount: number
}
