import { loadVerovio } from '../sheet/verovioLoader'
import { SheetMusicError } from '../sheet/sheetTypes'

function binaryStringToBuffer(value: string) {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index) & 0xff
  return bytes.buffer
}

function base64ToBuffer(value: string) {
  const binary = atob(value)
  return binaryStringToBuffer(binary)
}

function looksLikeMidi(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
  return bytes.length >= 4 && bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64
}

function decodeRenderedMidi(rendered: string) {
  const trimmed = rendered.trim()
  const dataUriMatch = /^data:[^,]*;base64,(.+)$/i.exec(trimmed)
  const candidates = dataUriMatch ? [dataUriMatch[1]] : [trimmed]

  for (const candidate of candidates) {
    try {
      const buffer = base64ToBuffer(candidate)
      if (looksLikeMidi(buffer)) return buffer
    } catch {
      // Thử tiếp dạng binary string bên dưới.
    }
  }

  const binaryBuffer = binaryStringToBuffer(rendered)
  if (looksLikeMidi(binaryBuffer)) return binaryBuffer

  throw new SheetMusicError('sheetMusic.errors.missingGeneratedMidi', 'missingGeneratedMidi')
}

export function isMusicXmlText(text: string) {
  const sample = text.slice(0, 4096).toLowerCase()
  return sample.includes('<score-partwise') || sample.includes('<score-timewise') || sample.includes('musicxml')
}

export async function createMidiCacheFromMusicXml(musicXml: string) {
  if (!isMusicXmlText(musicXml)) throw new SheetMusicError('sheetMusic.errors.invalidMusicXml', 'invalidMusicXml')

  try {
    const verovio = await loadVerovio()
    const toolkit = new verovio.toolkit()
    toolkit.loadData(musicXml)
    return decodeRenderedMidi(toolkit.renderToMIDI())
  } catch (error) {
    if (error instanceof SheetMusicError) throw error
    throw new SheetMusicError(error instanceof Error ? error.message : 'sheetMusic.errors.musicXmlToMidiFailed', 'musicXmlToMidiFailed')
  }
}
