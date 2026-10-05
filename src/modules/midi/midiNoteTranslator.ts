import type { MidiFile, TranslatedControlChange, TranslatedNote } from './midiTypes'
import { pairMidiNotes } from './midiNotePairs'
import { buildTempoMap, pulseToMicroseconds } from './midiTempo'

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

export function translateControlChanges(midi: MidiFile): TranslatedControlChange[] {
  const tempoMap = buildTempoMap(midi)
  const changes: TranslatedControlChange[] = []
  for (const event of midi.events) {
    if (event.type !== 'channel') continue
    if (!event.data || event.data.length < 3) continue
    const controllerNumber = event.data[1]
    const value = event.data[2]
    if (controllerNumber !== 64 && controllerNumber !== 66 && controllerNumber !== 67) continue
    
    changes.push({
      id: `cc:${event.trackId}:${event.channel}:${controllerNumber}:${event.pulse}`,
      timeUs: pulseToMicroseconds(event.pulse, midi.header.ticksPerQuarter, tempoMap),
      trackId: event.trackId,
      channel: event.channel ?? 0,
      controllerNumber,
      value
    })
  }
  return changes.sort((a, b) => a.timeUs - b.timeUs)
}
