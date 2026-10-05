import type { SheetShard, SheetSourceModel, SheetVoicePlan } from './sheetTypes'

interface MidiWriteEvent {
  tick: number
  priority: number
  bytes: number[]
}

function ascii(text: string) {
  return [...text].map(char => char.charCodeAt(0))
}

function u16(value: number) {
  return [(value >> 8) & 0xff, value & 0xff]
}

function u32(value: number) {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function vlq(value: number) {
  let buffer = value & 0x7f
  const bytes = [buffer]
  value >>= 7
  while (value > 0) {
    buffer = (value & 0x7f) | 0x80
    bytes.unshift(buffer)
    value >>= 7
  }
  return bytes
}

function meta(type: number, data: number[]) {
  return [0xff, type, ...vlq(data.length), ...data]
}

function textBytes(text: string) {
  return [...text].map(char => char.charCodeAt(0) & 0xff)
}

function trackChunk(events: MidiWriteEvent[]) {
  const sorted = [...events, { tick: Math.max(0, ...events.map(event => event.tick)), priority: 99, bytes: meta(0x2f, []) }]
    .sort((a, b) => a.tick - b.tick || a.priority - b.priority)
  const payload: number[] = []
  let previousTick = 0
  for (const event of sorted) {
    const tick = Math.max(0, Math.round(event.tick))
    payload.push(...vlq(Math.max(0, tick - previousTick)), ...event.bytes)
    previousTick = tick
  }
  return [...ascii('MTrk'), ...u32(payload.length), ...payload]
}

function keySignatureData(key: string | number, scale?: string) {
  const fifthsByKey: Record<string, number> = {
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
    F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
    a: 0, e: 1, b: 2, 'f#': 3, 'c#': 4, 'g#': 5, 'd#': 6, 'a#': 7,
    d: -1, g: -2, c: -3, f: -4, bb: -5, eb: -6, ab: -7,
  }
  const fifths = typeof key === 'number' ? key : fifthsByKey[String(key).replace('♭', 'b').replace('♯', '#')] ?? 0
  const mode = scale?.toLowerCase().startsWith('minor') ? 1 : 0
  return [(fifths + 256) & 0xff, mode]
}

function conductorEvents(model: SheetSourceModel): MidiWriteEvent[] {
  const events: MidiWriteEvent[] = []
  events.push({ tick: 0, priority: 0, bytes: meta(0x03, textBytes(model.name || 'PianoGame Sheet')) })
  for (const tempo of model.tempos) {
    const us = tempo.microsecondsPerQuarter
    events.push({ tick: tempo.tick, priority: 1, bytes: meta(0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]) })
  }
  for (const signature of model.timeSignatures) {
    const denominatorPower = Math.max(0, Math.round(Math.log2(signature.denominator)))
    events.push({ tick: signature.tick, priority: 2, bytes: meta(0x58, [signature.numerator, denominatorPower, 24, 8]) })
  }
  for (const signature of model.keySignatures) {
    events.push({ tick: signature.tick, priority: 3, bytes: meta(0x59, keySignatureData(signature.key, signature.scale)) })
  }
  return events
}

function bendBytes(value: number) {
  const raw = Math.max(0, Math.min(16383, Math.round((value + 1) * 8192)))
  return [raw & 0x7f, (raw >> 7) & 0x7f]
}

function voiceEvents(plan: SheetVoicePlan): MidiWriteEvent[] {
  const channel = Math.max(0, Math.min(15, plan.channel))
  const events: MidiWriteEvent[] = [
    { tick: 0, priority: 0, bytes: meta(0x03, textBytes(plan.name)) },
    { tick: 0, priority: 1, bytes: [0xc0 | channel, Math.max(0, Math.min(127, plan.program))] },
  ]

  for (const program of plan.programs) {
    events.push({ tick: program.tick, priority: 1, bytes: [0xc0 | channel, Math.max(0, Math.min(127, program.program))] })
  }
  for (const control of plan.controls) {
    events.push({ tick: control.tick, priority: 2, bytes: [0xb0 | channel, Math.max(0, Math.min(127, control.controller)), Math.max(0, Math.min(127, control.value))] })
  }
  for (const bend of plan.pitchBends) {
    events.push({ tick: bend.tick, priority: 2, bytes: [0xe0 | channel, ...bendBytes(bend.value)] })
  }

  for (const event of plan.events) {
    for (const pitch of event.pitches) {
      events.push({ tick: event.endTick, priority: 3, bytes: [0x80 | channel, pitch, 0] })
      events.push({ tick: event.startTick, priority: 4, bytes: [0x90 | channel, pitch, Math.max(1, Math.min(127, event.velocity))] })
    }
  }
  return events
}

export function serializeVoiceShard(model: SheetSourceModel, plan: SheetVoicePlan): SheetShard {
  const tracks = [trackChunk(conductorEvents(model)), trackChunk(voiceEvents(plan))]
  const header = [...ascii('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(model.ppq)]
  return {
    id: `staff-${plan.staff}-voice-${plan.id}`,
    staff: plan.staff,
    voice: plan.id,
    clef: plan.clef,
    name: plan.name,
    midiBytes: new Uint8Array([...header, ...tracks.flat()]),
    eventCount: plan.events.length,
  }
}
