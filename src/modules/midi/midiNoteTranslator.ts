import type { MidiFile, TranslatedNote } from './midiTypes'
import { buildTempoMap, pulseToMicroseconds } from './midiTempo'

export function translateNotes(midi: MidiFile): TranslatedNote[] {
  const tempoMap = buildTempoMap(midi)
  const open = new Map<string, { pulse: number; velocity: number }[]>()
  const notes: TranslatedNote[] = []
  const events = [...midi.events].sort((a, b) => a.pulse - b.pulse)
  for (const event of events) {
    if (event.type !== 'noteOn' && event.type !== 'noteOff') continue
    const channel = event.channel ?? 0
    const noteId = event.noteId ?? 0
    const key = `${event.trackId}:${channel}:${noteId}`
    if (event.type === 'noteOn' && (event.velocity ?? 0) > 0) {
      const list = open.get(key) ?? []
      list.push({ pulse: event.pulse, velocity: event.velocity ?? 64 })
      open.set(key, list)
    } else {
      const list = open.get(key)
      const start = list?.shift()
      if (!start) continue
      notes.push({
        id: `${key}:${start.pulse}:${event.pulse}`,
        start: pulseToMicroseconds(start.pulse, midi.header.ticksPerQuarter, tempoMap),
        end: pulseToMicroseconds(event.pulse, midi.header.ticksPerQuarter, tempoMap),
        noteId,
        trackId: event.trackId,
        channel,
        velocity: start.velocity,
        state: 'waiting',
      })
    }
  }
  return notes.sort((a, b) => a.start - b.start)
}
