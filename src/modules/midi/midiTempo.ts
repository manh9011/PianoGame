import type { MidiFile, RawMidiEvent } from './midiTypes'

export interface TempoPoint { pulse: number; microseconds: number; microsecondsPerQuarter: number }
export const DEFAULT_TEMPO = 500000

export function buildTempoMap(midi: MidiFile): TempoPoint[] {
  const tempos = midi.events.filter((e): e is RawMidiEvent & { tempo: number } => e.type === 'tempo' && typeof e.tempo === 'number').sort((a, b) => a.pulse - b.pulse)
  const points: TempoPoint[] = [{ pulse: 0, microseconds: 0, microsecondsPerQuarter: DEFAULT_TEMPO }]
  for (const event of tempos) {
    const current = points[points.length - 1]
    const elapsed = convertDeltaPulses(event.pulse - current.pulse, midi.header.ticksPerQuarter, current.microsecondsPerQuarter)
    points.push({ pulse: event.pulse, microseconds: current.microseconds + elapsed, microsecondsPerQuarter: event.tempo })
  }
  return points
}

export function convertDeltaPulses(pulses: number, ticksPerQuarter: number, tempo = DEFAULT_TEMPO) {
  return (pulses * tempo) / ticksPerQuarter
}

export function pulseToMicroseconds(pulse: number, ticksPerQuarter: number, tempoMap: TempoPoint[]) {
  let point = tempoMap[0]
  for (const candidate of tempoMap) {
    if (candidate.pulse <= pulse) point = candidate
    else break
  }
  return point.microseconds + convertDeltaPulses(pulse - point.pulse, ticksPerQuarter, point.microsecondsPerQuarter)
}

export function microsecondsToPulse(microseconds: number, ticksPerQuarter: number, tempoMap: TempoPoint[]) {
  let point = tempoMap[0]
  for (const candidate of tempoMap) {
    if (candidate.microseconds <= microseconds) point = candidate
    else break
  }
  const deltaUs = microseconds - point.microseconds
  return point.pulse + (deltaUs * ticksPerQuarter) / point.microsecondsPerQuarter
}
