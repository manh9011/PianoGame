import { Chord, Note } from '@tonaljs/tonal'
import type { FreePlayKeySignature, FreePlayKeySignatureMode } from '../../stores/freePlayStore'

const KEY_SIGNATURE_TO_FIFTHS: Record<FreePlayKeySignature, number> = {
  flat7: -7, flat6: -6, flat5: -5, flat4: -4, flat3: -3, flat2: -2, flat1: -1,
  natural: 0,
  sharp1: 1, sharp2: 2, sharp3: 3, sharp4: 4, sharp5: 5, sharp6: 6, sharp7: 7,
}

const NOTE_NAMES_BY_KEY_MAJOR: Record<number, readonly string[]> = {
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

const NOTE_NAMES_BY_KEY_MINOR: Record<number, readonly string[]> = {
  [-7]: ['C', 'Db', 'D', 'Eb', 'Fb', 'F', 'Gb', 'G', 'Ab', 'Bbb', 'Bb', 'Cb'],
  [-6]: ['C', 'Db', 'D', 'Eb', 'Fb', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb'],
  [-5]: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'Cb'],
  [-4]: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  [-3]: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  [-2]: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  [-1]: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  [0]: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  [1]: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  [2]: ['C', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  [3]: ['B#', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  [4]: ['B#', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'Fx', 'G#', 'A', 'A#', 'B'],
  [5]: ['B#', 'C#', 'Cx', 'D#', 'E', 'E#', 'F#', 'Fx', 'G#', 'A', 'A#', 'B'],
  [6]: ['B#', 'C#', 'Cx', 'D#', 'E', 'E#', 'F#', 'Fx', 'G#', 'Gx', 'A#', 'B'],
  [7]: ['B#', 'C#', 'Cx', 'D#', 'Dx', 'E#', 'F#', 'Fx', 'G#', 'Gx', 'A#', 'B'],
}

function getPitchClass(midi: number) {
  return ((midi % 12) + 12) % 12
}

function pitchClassName(midi: number, fifths: number, mode: 'major' | 'minor'): string {
  const chroma = getPitchClass(midi)
  const dictionary = mode === 'major' ? NOTE_NAMES_BY_KEY_MAJOR : NOTE_NAMES_BY_KEY_MINOR
  return dictionary[fifths]?.[chroma] ?? Note.fromMidiSharps(midi).replace(/\d/g, '')
}

export function detectBestChord(
  midiNotes: number[],
  keySignature: FreePlayKeySignature,
  mode: FreePlayKeySignatureMode,
): string {
  if (midiNotes.length < 2) return ''

  const fifths = KEY_SIGNATURE_TO_FIFTHS[keySignature] ?? 0

  const seenPitchClasses = new Set<number>()
  const noteNames: string[] = [...midiNotes]
    .sort((a, b) => a - b)
    .reduce<string[]>((acc, midi) => {
      const pc = getPitchClass(midi)
      if (seenPitchClasses.has(pc)) return acc
      seenPitchClasses.add(pc)
      acc.push(pitchClassName(midi, fifths, mode))
      return acc
    }, [])

  if (noteNames.length < 2) return ''

  const chords = Chord.detect(noteNames)
  if (chords.length === 0) return ''

  const scored = chords.map((name, index) => {
    const chordInfo = Chord.get(name)
    const rootChroma = chordInfo.tonic ? Note.chroma(chordInfo.tonic) : -1

    let score = 0

    const bassPc = getPitchClass(Math.min(...midiNotes))
    if (rootChroma === bassPc) score += 2.5

    if (rootChroma >= 0) {
      const majorTonic = getPitchClass(fifths * 7)
      const tonic = mode === 'major' ? majorTonic : getPitchClass(majorTonic + 9)
      const intervals = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]
      const scale = new Set(intervals.map(i => getPitchClass(tonic + i)))
      if (scale.has(rootChroma)) score += 1.5
      if (rootChroma === tonic) score += 1
      if (rootChroma === getPitchClass(tonic + 7)) score += 0.6
    }

    const [symbol] = name.split('/')
    const alteredTones = symbol.match(/(?:#|b)(?:5|9|11|13)/g)?.length ?? 0
    const complexityPenalty = alteredTones * 2 + (name.includes('/') ? 1 : 0)

    return { name, score: score - complexityPenalty - index * 0.1 }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.name ?? ''
}
