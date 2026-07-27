import { Midi } from '@tonejs/midi'
import type { FreePlayRecordedNote } from '../../stores/freePlayStore'

export function createFreePlayMidi(notes: FreePlayRecordedNote[], bpm = 120) {
  const midi = new Midi()
  midi.header.setTempo(bpm)
  const track = midi.addTrack()
  track.instrument.number = 0
  track.instrument.name = 'Acoustic Grand Piano'

  for (const note of [...notes].sort((a, b) => a.startUs - b.startUs)) {
    const durationUs = Math.max(10_000, note.endUs - note.startUs)
    track.addNote({
      midi: note.noteId,
      time: note.startUs / 1_000_000,
      duration: durationUs / 1_000_000,
      velocity: Math.max(0.01, Math.min(1, note.velocity / 127)),
    })
  }

  return midi.toArray()
}
