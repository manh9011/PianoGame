import type { MidiFile } from './midiTypes'
import { buildTempoMap, pulseToMicroseconds } from './midiTempo'

export interface PairedMidiNote {
  id: string
  startPulse: number
  endPulse: number
  startUs: number
  endUs: number
  noteId: number
  trackId: number
  channel: number
  velocity: number
}

export function pairMidiNotes(midi: MidiFile): PairedMidiNote[] {
  const tempoMap = buildTempoMap(midi)
  const open = new Map<string, { pulse: number; velocity: number }[]>()
  const notes: PairedMidiNote[] = []
  const events = [...midi.events].sort((a, b) => a.pulse - b.pulse || a.trackId - b.trackId)

  for (const event of events) {
    if (event.type !== 'noteOn' && event.type !== 'noteOff') continue
    const channel = event.channel ?? 0
    const noteId = event.noteId ?? 0
    const key = `${event.trackId}:${channel}:${noteId}`

    if (event.type === 'noteOn' && (event.velocity ?? 0) > 0) {
      const list = open.get(key) ?? []
      list.push({ pulse: event.pulse, velocity: event.velocity ?? 64 })
      open.set(key, list)
      continue
    }

    const list = open.get(key)
    const start = list?.shift()
    if (!start || event.pulse <= start.pulse) continue

    notes.push({
      id: `${key}:${start.pulse}:${event.pulse}`,
      startPulse: start.pulse,
      endPulse: event.pulse,
      startUs: pulseToMicroseconds(start.pulse, midi.header.ticksPerQuarter, tempoMap),
      endUs: pulseToMicroseconds(event.pulse, midi.header.ticksPerQuarter, tempoMap),
      noteId,
      trackId: event.trackId,
      channel,
      velocity: start.velocity,
    })
  }

  return notes.sort((a, b) => a.startUs - b.startUs || a.noteId - b.noteId)
}
