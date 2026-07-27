import { Midi } from '@tonejs/midi'
import { getInstrumentByProgram } from '../audio/gmInstrumentCatalog'
import type { FreePlayTrack } from '../../stores/freePlayStore'

export function createFreePlayMidi(tracks: FreePlayTrack[], bpm = 120) {
  const midi = new Midi()
  midi.header.setTempo(bpm)

  for (const sourceTrack of tracks) {
    if (!sourceTrack.notes.length) continue
    const instrument = getInstrumentByProgram(sourceTrack.instrumentProgram)
    const track = midi.addTrack()
    track.instrument.number = sourceTrack.instrumentProgram
    track.instrument.name = instrument.name

    for (const note of [...sourceTrack.notes].sort((a, b) => a.startUs - b.startUs)) {
      const durationUs = Math.max(10_000, note.endUs - note.startUs)
      track.addNote({
        midi: note.noteId,
        time: note.startUs / 1_000_000,
        duration: durationUs / 1_000_000,
        velocity: Math.max(0.01, Math.min(1, note.velocity / 127)),
      })
    }
  }

  return midi.toArray()
}
