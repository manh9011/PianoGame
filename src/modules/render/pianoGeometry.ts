export interface PianoKey { noteId: number; name: string; black: boolean; x: number; width: number }
const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export function noteName(noteId: number) { return `${names[noteId % 12]}${Math.floor(noteId / 12) - 1}` }

const BLACK_KEY_WIDTH = 0.67
const WHITE_KEY_WIDTH = 1
const GROUP3_SPACE = (3 * WHITE_KEY_WIDTH - 2 * BLACK_KEY_WIDTH) / 3
const GROUP4_SPACE = (4 * WHITE_KEY_WIDTH - 3 * BLACK_KEY_WIDTH) / 4

function blackKeyX(noteId: number, noteMod: number) {
  if (noteId === 22) return WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 4

  const octaveIndex = Math.floor((noteId - 24) / 12)
  const octaveOffset = 2 * WHITE_KEY_WIDTH + octaveIndex * 7 * WHITE_KEY_WIDTH

  switch (noteMod) {
    case 1: return octaveOffset + GROUP3_SPACE
    case 3: return octaveOffset + 2 * GROUP3_SPACE + BLACK_KEY_WIDTH
    case 6: return octaveOffset + 3 * WHITE_KEY_WIDTH + GROUP4_SPACE
    case 8: return octaveOffset + 3 * WHITE_KEY_WIDTH + 2 * GROUP4_SPACE + BLACK_KEY_WIDTH
    case 10: return octaveOffset + 3 * WHITE_KEY_WIDTH + 3 * GROUP4_SPACE + 2 * BLACK_KEY_WIDTH
    default: return octaveOffset
  }
}

export function createPianoKeys(): PianoKey[] {
  const keys: PianoKey[] = []
  let white = 0

  for (let noteId = 21; noteId <= 108; noteId++) {
    const noteMod = noteId % 12
    const black = names[noteMod].includes('#')

    if (black) {
      keys.push({ noteId, name: noteName(noteId), black, x: blackKeyX(noteId, noteMod), width: BLACK_KEY_WIDTH })
    } else {
      keys.push({ noteId, name: noteName(noteId), black, x: white++, width: WHITE_KEY_WIDTH })
    }
  }

  return keys
}
export const WHITE_KEY_COUNT = 52
