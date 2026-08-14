export interface MidiDeviceInfo { id: string; name: string }

export type MidiAccess = { inputs: Map<string, MIDIInput>; outputs: Map<string, MIDIOutput> }
export type MIDIInput = { id: string; name?: string; onmidimessage: ((event: { data: Uint8Array }) => void) | null }
export type MIDIOutput = { id: string; name?: string; send: (data: number[]) => void }

export function isWebMidiSupported() { return 'requestMIDIAccess' in navigator }

export async function requestMidiAccess(options?: { sysex?: boolean }): Promise<MidiAccess | null> {
  const midiNavigator = navigator as unknown as { requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MidiAccess> }

  const notifyUnsupported = () => {
    import('../../stores/toastStore').then(({ useToastStore }) => {
      useToastStore().show('Your browser/device does not support WebMIDI (e.g., Safari/iOS). Please use Google Chrome, Edge, or the desktop application.', 'error')
    }).catch(() => { })
  }

  if (!midiNavigator.requestMIDIAccess) {
    notifyUnsupported()
    return null
  }

  try {
    return await midiNavigator.requestMIDIAccess(options)
  } catch (error) {
    console.warn('Không thể truy cập Web MIDI API (bị từ chối quyền hoặc không hỗ trợ):', error)
    notifyUnsupported()
    return null
  }
}

export function listInputs(access: MidiAccess | null): MidiDeviceInfo[] { return access ? [...access.inputs.values()].map(d => ({ id: d.id, name: d.name || d.id })) : [] }
export function listOutputs(access: MidiAccess | null): MidiDeviceInfo[] { return access ? [...access.outputs.values()].map(d => ({ id: d.id, name: d.name || d.id })) : [] }

export function bindInput(access: MidiAccess | null, id: string, cb: (note: number, velocity: number, on: boolean) => void, cbCC?: (controller: number, value: number) => void) {
  access?.inputs.forEach(input => { input.onmidimessage = null })
  const input = access?.inputs.get(id)
  if (!input) return
  input.onmidimessage = e => { const [s, n, v] = [...e.data]; const k = s & 0xf0; if (k === 0x90 || k === 0x80) cb(n, v, k === 0x90 && v > 0); else if (k === 0xb0 && cbCC) cbCC(n, v) }
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

export function parseMidiSysExOrRealtime(data: Uint8Array): string | null {
  if (!data || data.length === 0) return null

  // System Realtime (1 byte)
  if (data.length === 1) {
    const status = data[0]
    if (status === 0xFA || status === 0xFB) return 'MMC Play'
    if (status === 0xFC) return 'Play/Pause'
  }

  // SysEx (F0 ... F7)
  if (data[0] === 0xF0 && data[data.length - 1] === 0xF7) {
    // MMC Header check: F0 7F <deviceId> 06 <command> F7
    if (data.length >= 6 && data[1] === 0x7F && data[3] === 0x06) {
      const cmd = data[4]
      switch (cmd) {
        case 0x01: return 'Play/Pause'
        case 0x02:
        case 0x03: return 'MMC Play'
        case 0x04: return 'MMC Fast Forward'
        case 0x05: return 'MMC Rewind'
        case 0x06:
        case 0x07: return 'MMC Record'
        case 0x09: return 'Play/Pause'
        case 0x0D: return 'Strobe'
        default: return `MMC (0x${cmd.toString(16).toUpperCase()})`
      }
    }
    return 'SysEx Event'
  }

  return null
}

export function bindMidiMessageListener(
  access: MidiAccess | null,
  onMessage: (name: string, data: Uint8Array) => void
): () => void {
  if (!access) return () => { }

  const unbindFns: Array<() => void> = []

  access.inputs.forEach(input => {
    const prevHandler = input.onmidimessage
    const handler = (e: { data: Uint8Array }) => {
      if (prevHandler) prevHandler(e)
      const name = parseMidiSysExOrRealtime(e.data)
      if (name) {
        onMessage(name, e.data)
      }
    }
    input.onmidimessage = handler
    unbindFns.push(() => {
      if (input.onmidimessage === handler) {
        input.onmidimessage = prevHandler
      }
    })
  })

  return () => {
    unbindFns.forEach(fn => fn())
  }
}