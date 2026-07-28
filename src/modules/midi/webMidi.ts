export interface MidiDeviceInfo { id: string; name: string }

type MidiAccess = { inputs: Map<string, MIDIInput>; outputs: Map<string, MIDIOutput> }
type MIDIInput = { id: string; name?: string; onmidimessage: ((event: { data: Uint8Array }) => void) | null }
type MIDIOutput = { id: string; name?: string; send: (data: number[]) => void }

export function isWebMidiSupported() { return 'requestMIDIAccess' in navigator }
export async function requestMidiAccess(): Promise<MidiAccess | null> {
  const midiNavigator = navigator as unknown as { requestMIDIAccess?: () => Promise<MidiAccess> }
  return midiNavigator.requestMIDIAccess ? midiNavigator.requestMIDIAccess() : null
}
export function listInputs(access: MidiAccess | null): MidiDeviceInfo[] { return access ? [...access.inputs.values()].map(d => ({ id: d.id, name: d.name || d.id })) : [] }
export function listOutputs(access: MidiAccess | null): MidiDeviceInfo[] { return access ? [...access.outputs.values()].map(d => ({ id: d.id, name: d.name || d.id })) : [] }
export function bindInput(access: MidiAccess | null, id: string, cb: (note: number, velocity: number, on: boolean) => void) {
  access?.inputs.forEach(input => { input.onmidimessage = null })
  const input = access?.inputs.get(id)
  if (!input) return
  input.onmidimessage = e => { const [s, n, v] = [...e.data]; const k = s & 0xf0; if (k === 0x90 || k === 0x80) cb(n, v, k === 0x90 && v > 0) }
}
export function sendNote(access: MidiAccess | null, id: string, note: number, velocity: number, on: boolean, channel = 0) {
  const safeChannel = Math.max(0, Math.min(15, channel))
  access?.outputs.get(id)?.send([(on ? 0x90 : 0x80) | safeChannel, note, velocity])
}

export function sendProgramChange(access: MidiAccess | null, id: string, channel: number, program: number) {
  const safeChannel = Math.max(0, Math.min(15, channel))
  const safeProgram = Math.max(0, Math.min(127, program))
  access?.outputs.get(id)?.send([0xc0 | safeChannel, safeProgram])
}