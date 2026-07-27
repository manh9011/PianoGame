import type { LabelMode, RecordVideoOrientation, RecordVideoSize } from '../../../types/settings'
import type { Hand, PlaySession, SessionKeySignature } from '../../game/playSession'
import type { TrackMode } from '../../game/trackProperties'
import type { KeyboardRange } from '../keyboardRange'

export interface RecordRenderableNote {
  id: string
  startUs: number
  endUs: number
  noteId: number
  trackId: number
  velocity: number
  hand: Hand
  finger?: number | null
  fingerSource?: 'manual' | 'auto'
}

export interface RecordRenderableTrack {
  trackId: number
  mode: TrackMode
  color: string
  hitColor: string
  blackColor: string
  instrumentProgram: number
}

export interface RecordRenderScene {
  notes: RecordRenderableNote[]
  tracks: RecordRenderableTrack[]
  measureGridUs: number[]
  keySignatures: SessionKeySignature[]
  durationUs: number
  keyboardRange: KeyboardRange
  showDuration: number
  speed: number
  title: string
}

export interface RecordRenderVisualOptions {
  showGrid: boolean
  showFallingNotes: boolean
  showKeyboard: boolean
  showKeyLabels: boolean
  showNoteLabels: boolean
  showFingerHints: boolean
  showColoredFingerHints: boolean
  keyLabelMode: LabelMode | 'none'
  noteLabelMode: LabelMode | 'none'
  keyLabelSize: number
  noteLabelSize: number
  orientation: RecordVideoOrientation
  videoSize: RecordVideoSize
  backgroundOpacity: number
  logoEnabled: boolean
}

export interface RecordRenderImages {
  background: ImageBitmap | null
  logo: ImageBitmap | null
}

export interface RecordVideoDimensions {
  width: number
  height: number
}

export const RECORD_VIDEO_SIZE_MAP: Record<RecordVideoSize, RecordVideoDimensions> = {
  sd: { width: 854, height: 480 },
  hd: { width: 1280, height: 720 },
  fhd: { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
}

export function resolveRecordVideoDimensions(videoSize: RecordVideoSize, orientation: RecordVideoOrientation): RecordVideoDimensions {
  const base = RECORD_VIDEO_SIZE_MAP[videoSize]
  if (orientation === 'portrait') {
    return { width: base.height, height: base.width }
  }
  return { ...base }
}

export function createRecordRenderScene(session: PlaySession, title: string): RecordRenderScene {
  return {
    notes: session.notes.map(note => ({
      id: note.id,
      startUs: note.start,
      endUs: note.end,
      noteId: note.noteId,
      trackId: note.trackId,
      velocity: note.velocity,
      hand: note.hand,
      finger: note.finger,
      fingerSource: note.fingerSource,
    })),
    tracks: session.tracks.map(track => ({
      trackId: track.trackId,
      mode: track.mode,
      color: track.color,
      hitColor: track.hitColor,
      blackColor: track.blackColor,
      instrumentProgram: track.instrumentProgram,
    })),
    measureGridUs: [...session.measureGridUs],
    keySignatures: session.keySignatures.map(signature => ({ ...signature })),
    durationUs: session.loopState.durationUs,
    keyboardRange: session.keyboardRange ?? { lowNote: 21, highNote: 108 },
    showDuration: session.showDuration,
    speed: session.speed,
    title,
  }
}
