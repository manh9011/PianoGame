import type { KeyboardRangeMode } from '../../types/settings'
import type { SessionNote } from '../game/playSession'

export interface KeyboardRange {
  lowNote: number
  highNote: number
}

export const KEYBOARD_RANGE_PRESETS: Record<'18-keys' | '25-keys' | '88-keys', KeyboardRange> = {
  '18-keys': { lowNote: 48, highNote: 65 },   // C3 -> F4
  '25-keys': { lowNote: 48, highNote: 72 },   // C3 -> C5
  '88-keys': { lowNote: 21, highNote: 108 },  // A0 -> C8 (full piano)
}

export function computeSongRange(notes: SessionNote[]): KeyboardRange {
  if (notes.length === 0) return KEYBOARD_RANGE_PRESETS['88-keys']
  let low = 127
  let high = 0
  for (const note of notes) {
    if (note.noteId < low) low = note.noteId
    if (note.noteId > high) high = note.noteId
  }
  return { lowNote: low, highNote: high }
}

export function getKeyboardRange(mode: KeyboardRangeMode, notes: SessionNote[]): KeyboardRange {
  switch (mode) {
    case '18-keys':
    case '25-keys':
    case '88-keys':
      return KEYBOARD_RANGE_PRESETS[mode]
    case 'song-only':
      return computeSongRange(notes)
    case 'my-notes':
    case 'my-keyboard':
    case 'custom':
    default:
      return KEYBOARD_RANGE_PRESETS['88-keys']
  }
}

export function isNoteInRange(noteId: number, range: KeyboardRange): boolean {
  return noteId >= range.lowNote && noteId <= range.highNote
}
