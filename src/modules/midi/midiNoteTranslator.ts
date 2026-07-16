import type { MidiFile, TranslatedNote } from './midiTypes'
import { pairMidiNotes } from './midiNotePairs'

export function translateNotes(midi: MidiFile): TranslatedNote[] {
  return pairMidiNotes(midi).map(note => ({
    id: note.id,
    start: note.startUs,
    end: note.endUs,
    noteId: note.noteId,
    trackId: note.trackId,
    channel: note.channel,
    velocity: note.velocity,
    state: 'waiting',
  }))
}
