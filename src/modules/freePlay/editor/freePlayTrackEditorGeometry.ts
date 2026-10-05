import type { FreePlayTimeSignature } from '../../../stores/freePlayStore'
import { parseFreePlayTimeSignature } from '../../../stores/freePlayStore'
import { quarterNoteUs } from './freePlayTrackEditorSnap'

export const FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US = 10_000
export const FREE_PLAY_EDITOR_PITCH_MIN = 0
export const FREE_PLAY_EDITOR_PITCH_MAX = 127

export interface FreePlayEditorGeometryOptions {
  bpm: number
  timeSignature: FreePlayTimeSignature
  pixelsPerQuarter: number
  rowHeight: number
}

export function clampPitch(noteId: number) {
  return Math.max(FREE_PLAY_EDITOR_PITCH_MIN, Math.min(FREE_PLAY_EDITOR_PITCH_MAX, Math.round(noteId)))
}

export function timeToX(timeUs: number, bpm: number, pixelsPerQuarter: number) {
  return Math.max(0, timeUs) * (pixelsPerQuarter / quarterNoteUs(bpm))
}

export function xToTime(x: number, bpm: number, pixelsPerQuarter: number) {
  return Math.max(0, x) / (pixelsPerQuarter / quarterNoteUs(bpm))
}

export function pitchToY(noteId: number, rowHeight: number) {
  return (FREE_PLAY_EDITOR_PITCH_MAX - clampPitch(noteId)) * rowHeight
}

export function yToPitch(y: number, rowHeight: number) {
  return clampPitch(FREE_PLAY_EDITOR_PITCH_MAX - Math.floor(Math.max(0, y) / rowHeight))
}

export function editorBeatUs(bpm: number, timeSignature: FreePlayTimeSignature) {
  const signature = parseFreePlayTimeSignature(timeSignature)
  return quarterNoteUs(bpm) * (4 / signature.denominator)
}

export function editorMeasureUs(bpm: number, timeSignature: FreePlayTimeSignature) {
  const signature = parseFreePlayTimeSignature(timeSignature)
  return editorBeatUs(bpm, timeSignature) * signature.numerator
}

export function intersectsRect(a: DOMRect | { left: number; top: number; right: number; bottom: number }, b: DOMRect | { left: number; top: number; right: number; bottom: number }) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
}
