export interface MidiNote {
  pitch: number // MIDI note number
  onsetSample: number
  durationSample: number
  velocity: number // 1..127
}

export interface PedalChange {
  sample: number
  on: boolean
}

const TICKS_PER_QUARTER = 480
const TEMPO_US_PER_QUARTER = 500000 // 120 BPM

function writeVarLen(bytes: number[], value: number): void {
  let buffer = value & 0x7f
  const stack: number[] = [buffer]
  value >>= 7
  while (value > 0) {
    stack.unshift((value & 0x7f) | 0x80)
    value >>= 7
  }
  bytes.push(...stack)
}

function u32be(bytes: number[], value: number): void {
  bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff)
}

function u16be(bytes: number[], value: number): void {
  bytes.push((value >>> 8) & 0xff, value & 0xff)
}

interface RawEvent {
  tick: number
  order: number // stable tie-break: offs before ons at the same tick
  bytes: number[]
}

/**
 * Build a Standard MIDI File (format 0, single track) from decoded notes + sustain-pedal
 * changes. Sample positions are converted to ticks assuming a fixed 120 BPM / 480 PPQ grid
 * (Transkun emits real performance timing in seconds; this just re-expresses it in MIDI's
 * tick units at a display tempo — the actual note timing is unaffected).
 */
export function writeMidi(notes: MidiNote[], pedal: PedalChange[], sampleRate: number): Uint8Array {
  const secondsToTicks = (sample: number) => {
    const seconds = sample / sampleRate
    return Math.round(seconds * (TICKS_PER_QUARTER / (TEMPO_US_PER_QUARTER / 1e6)))
  }

  const events: RawEvent[] = []
  let order = 0

  for (const n of notes) {
    const onTick = secondsToTicks(n.onsetSample)
    const offTick = secondsToTicks(n.onsetSample + n.durationSample)
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity)))
    events.push({ tick: offTick, order: order++, bytes: [0x80, n.pitch & 0x7f, 0] }) // note off first at ties
    events.push({ tick: onTick, order: order++, bytes: [0x90, n.pitch & 0x7f, vel] })
  }

  for (const p of pedal) {
    const tick = secondsToTicks(p.sample)
    events.push({ tick, order: order++, bytes: [0xb0, 64, p.on ? 127 : 0] })
  }

  events.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : a.order - b.order))

  const track: number[] = []
  // Tempo meta event at tick 0.
  writeVarLen(track, 0)
  track.push(0xff, 0x51, 0x03, (TEMPO_US_PER_QUARTER >> 16) & 0xff, (TEMPO_US_PER_QUARTER >> 8) & 0xff, TEMPO_US_PER_QUARTER & 0xff)

  let prevTick = 0
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - prevTick)
    writeVarLen(track, delta)
    track.push(...ev.bytes)
    prevTick = ev.tick
  }
  // End of track.
  writeVarLen(track, 0)
  track.push(0xff, 0x2f, 0x00)

  const bytes: number[] = []
  // MThd
  bytes.push(0x4d, 0x54, 0x68, 0x64)
  u32be(bytes, 6)
  u16be(bytes, 0) // format 0
  u16be(bytes, 1) // 1 track
  u16be(bytes, TICKS_PER_QUARTER)
  // MTrk
  bytes.push(0x4d, 0x54, 0x72, 0x6b)
  u32be(bytes, track.length)
  bytes.push(...track)

  return new Uint8Array(bytes)
}
