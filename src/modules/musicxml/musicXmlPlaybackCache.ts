import { loadVerovio } from '../sheet/verovioLoader'
import { SheetMusicError } from '../sheet/sheetTypes'
import WebMscore from 'webmscore'

function binaryStringToBuffer(value: string) {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index) & 0xff
  return bytes.buffer
}

function base64ToBuffer(value: string) {
  const binary = atob(value)
  return binaryStringToBuffer(binary)
}

function bufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
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
    try {
      await WebMscore.ready
      const musicXmlBytes = new TextEncoder().encode(musicXml)
      const musicXmlCopy = new Uint8Array(musicXmlBytes.length) // Pass a copy so the original buffer is not transferred/detached
      musicXmlCopy.set(musicXmlBytes)
      const score = await WebMscore.load('xml', musicXmlCopy, [], false)
      const midiBytes = await score.saveMidi()
      const midiCopy = new Uint8Array(midiBytes)
      score.destroy()
      return midiCopy.buffer as ArrayBuffer
    } catch (webmscoreError) {
      console.warn('[MusicXML] webmscore fallback to Verovio due to error:', webmscoreError)
      const verovio = await loadVerovio()
      const toolkit = new verovio.toolkit()
      toolkit.loadData(musicXml)
      return decodeRenderedMidi(toolkit.renderToMIDI())
    }
  } catch (error) {
    if (error instanceof SheetMusicError) throw error
    throw new SheetMusicError(error instanceof Error ? error.message : 'sheetMusic.errors.musicXmlToMidiFailed', 'musicXmlToMidiFailed')
  }
}

export async function createMidiCacheFromCompressedMusicXml(buffer: ArrayBuffer) {
  try {
    try {
      await WebMscore.ready
      // Pass a copy so the original buffer is not transferred/detached by WebMscore
      const bufferCopy = new Uint8Array(buffer.byteLength)
      bufferCopy.set(new Uint8Array(buffer))
      const score = await WebMscore.load('mxl', bufferCopy, [], false)
      const midiBytes = await score.saveMidi()
      const midiCopy = new Uint8Array(midiBytes)
      score.destroy()
      return midiCopy.buffer as ArrayBuffer
    } catch (webmscoreError) {
      console.warn('[MusicXML] webmscore fallback to Verovio due to error:', webmscoreError)
      const verovio = await loadVerovio()
      const toolkit = new verovio.toolkit()
      toolkit.loadZipDataBase64(bufferToBase64(buffer))
      return decodeRenderedMidi(toolkit.renderToMIDI())
    }
  } catch (error) {
    if (error instanceof SheetMusicError) throw error
    throw new SheetMusicError(error instanceof Error ? error.message : 'sheetMusic.errors.musicXmlToMidiFailed', 'musicXmlToMidiFailed')
  }
}
