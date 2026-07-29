import type { LabelMode } from '../../types/settings'

const ENGLISH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const SIMPLE_NAMES = ['C', null, 'D', null, 'E', 'F', null, 'G', null, 'A', null, 'B'] as const

type KeySignatureAccidentals = -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

const NOTE_NAMES_BY_KEY_SIGNATURE: Record<KeySignatureAccidentals, readonly string[]> = {
  [-7]: ['Dbb', 'Db', 'Ebb', 'Eb', 'Fb', 'F', 'Gb', 'Abb', 'Ab', 'Bbb', 'Bb', 'Cb'],
  [-6]: ['C', 'Db', 'Ebb', 'Eb', 'Fb', 'F', 'Gb', 'Abb', 'Ab', 'Bbb', 'Bb', 'Cb'],
  [-5]: ['C', 'Db', 'Ebb', 'Eb', 'Fb', 'F', 'Gb', 'G', 'Ab', 'Bbb', 'Bb', 'Cb'],
  [-4]: ['C', 'Db', 'D', 'Eb', 'Fb', 'F', 'Gb', 'G', 'Ab', 'Bbb', 'Bb', 'Cb'],
  [-3]: ['C', 'Db', 'D', 'Eb', 'Fb', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb'],
  [-2]: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb'],
  [-1]: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  [0]: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  [1]: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  [2]: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  [3]: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  [4]: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  [5]: ['C', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  [6]: ['B#', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  [7]: ['B#', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'Fx', 'G#', 'A', 'A#', 'B'],
}

const MAJOR_KEY_SIGNATURES: Record<string, KeySignatureAccidentals> = {
  Cb: -7,
  Gb: -6,
  Db: -5,
  Ab: -4,
  Eb: -3,
  Bb: -2,
  F: -1,
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
}

const MINOR_KEY_SIGNATURES: Record<string, KeySignatureAccidentals> = {
  Ab: -7,
  Eb: -6,
  Bb: -5,
  F: -4,
  C: -3,
  G: -2,
  D: -1,
  A: 0,
  E: 1,
  B: 2,
  'F#': 3,
  'C#': 4,
  'G#': 5,
  'D#': 6,
  'A#': 7,
}
const SCALE_NUMBERS = ['1', null, '2', null, '3', '4', null, '5', null, '6', null, '7'] as const
const MOVABLE_DO_NAMES = ['Do', null, 'Re', null, 'Mi', 'Fa', null, 'So', null, 'La', null, 'Ti'] as const
const FIXED_DO_NAMES = ['Do', 'Do', 'Re', 'Re', 'Mi', 'Fa', 'Fa', 'Sol', 'Sol', 'La', 'La', 'Ti'] as const

const VIRTUAL_PIANO_KEY_TO_NOTE = new Map<string, number>([
  ['a', 60],
  ['w', 61],
  ['s', 62],
  ['e', 63],
  ['d', 64],
  ['f', 65],
  ['t', 66],
  ['g', 67],
  ['y', 68],
  ['h', 69],
  ['u', 70],
  ['j', 71],
  ['k', 72],
  ['o', 73],
  ['l', 74],
  ['p', 75],
  [';', 76],
  ["'", 77],
])

const VIRTUAL_PIANO_NOTE_TO_KEY = new Map<number, string>(
  [...VIRTUAL_PIANO_KEY_TO_NOTE.entries()].map(([key, noteId]) => [noteId, key])
)

export function notePitchClass(noteId: number) {
  return ((noteId % 12) + 12) % 12
}

export function noteOctave(noteId: number) {
  return Math.floor(noteId / 12) - 1
}

export function isBlackNote(noteId: number) {
  return ENGLISH_NAMES[notePitchClass(noteId)].includes('#')
}

function normalizeKeyName(key: string) {
  return key.trim().replace(/♭/g, 'b').replace(/♯/g, '#')
}

export function getKeySignatureAccidentals(key?: string, scale?: string): KeySignatureAccidentals {
  const cleanKey = normalizeKeyName(key || 'C')
  const signatures = scale?.toLowerCase() === 'minor' ? MINOR_KEY_SIGNATURES : MAJOR_KEY_SIGNATURES
  return signatures[cleanKey] ?? 0
}

export const ACCIDENTAL_TO_KEY_SIGNATURE_ID: Record<KeySignatureAccidentals, string> = {
  [-7]: 'flat7',
  [-6]: 'flat6',
  [-5]: 'flat5',
  [-4]: 'flat4',
  [-3]: 'flat3',
  [-2]: 'flat2',
  [-1]: 'flat1',
  [0]: 'natural',
  [1]: 'sharp1',
  [2]: 'sharp2',
  [3]: 'sharp3',
  [4]: 'sharp4',
  [5]: 'sharp5',
  [6]: 'sharp6',
  [7]: 'sharp7',
}

export function parseKeySignatureLabel(label?: string): { key: string; scale: string } {
  if (!label) return { key: 'C', scale: 'major' }
  const parts = label.trim().split(/\s+/)
  if (parts.length >= 2) {
    const scaleStr = parts[1].toLowerCase()
    const scale = scaleStr.includes('minor') ? 'minor' : 'major'
    return { key: parts[0], scale }
  }
  return { key: label.trim() || 'C', scale: 'major' }
}

export function formatKeySignature(
  key?: string,
  scale?: string,
  t?: (key: string) => string,
  rawLabel?: string
): string {
  let finalKey = key
  let finalScale = scale
  if (!finalKey && !finalScale && rawLabel) {
    const parsed = parseKeySignatureLabel(rawLabel)
    finalKey = parsed.key
    finalScale = parsed.scale
  }
  if (!finalKey) finalKey = 'C'
  if (!finalScale) finalScale = 'major'

  const accidentals = getKeySignatureAccidentals(finalKey, finalScale)
  const keyId = ACCIDENTAL_TO_KEY_SIGNATURE_ID[accidentals] ?? 'natural'
  const isMinor = finalScale.toLowerCase() === 'minor'

  if (t) {
    const translationKey = `freePlay.keySignatureNames.${keyId}`
    const translation = t(translationKey)
    if (translation && translation !== translationKey) {
      const parts = translation.split('/').map(p => p.trim())
      if (isMinor) {
        return parts[1] ?? parts[0]
      }
      return parts[0]
    }
  }

  const cleanKey = finalKey || 'C'
  const titleScale = isMinor ? 'Minor' : 'Major'
  return `${cleanKey} ${titleScale}`
}

export function getEnglishNoteName(noteId: number, keySignatureAccidentals = 0) {
  const pitchClass = notePitchClass(noteId)
  const signature = Math.max(-7, Math.min(7, Math.round(keySignatureAccidentals))) as KeySignatureAccidentals
  return NOTE_NAMES_BY_KEY_SIGNATURE[signature][pitchClass]
}

export function getVirtualPianoNoteIdFromKey(key: string) {
  return VIRTUAL_PIANO_KEY_TO_NOTE.get(key.toLowerCase()) ?? null
}

export function getVirtualPianoLabel(noteId: number) {
  return VIRTUAL_PIANO_NOTE_TO_KEY.get(noteId) ?? null
}

function getLabelForMode(mode: LabelMode, noteId: number, keySignatureAccidentals = 0) {
  const pitchClass = notePitchClass(noteId)

  switch (mode) {
    case 'octaves':
      return pitchClass === 0 ? `C${noteOctave(noteId)}` : null
    case 'finger-hint':
      return null
    case 'virtual-piano':
      return getVirtualPianoLabel(noteId)
    case 'english':
      return getEnglishNoteName(noteId, keySignatureAccidentals)
    case 'fixed-do':
      return FIXED_DO_NAMES[pitchClass]
    case 'movable-do':
      return MOVABLE_DO_NAMES[pitchClass]
    case 'scale-number':
      return SCALE_NUMBERS[pitchClass]
    case 'simple':
      return SIMPLE_NAMES[pitchClass]
  }
}

export function getKeyboardLabel(mode: LabelMode, noteId: number, keySignatureAccidentals = 0) {
  return getLabelForMode(mode, noteId, keySignatureAccidentals)
}

export function getNoteLabel(mode: LabelMode, noteId: number, keySignatureAccidentals = 0, finger?: number | null) {
  if (mode === 'finger-hint') return finger ? String(finger) : null
  return getLabelForMode(mode, noteId, keySignatureAccidentals)
}
