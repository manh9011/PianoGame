import { computeMidiHash } from '../midi/midiHash'
import { parseMidi } from '../midi/midiParser'
import { translateNotes } from '../midi/midiNoteTranslator'
import { buildTempoMap, pulseToMicroseconds } from '../midi/midiTempo'
import { SheetMusicError } from '../sheet/sheetTypes'
import { createMidiCacheFromMusicXml, isMusicXmlText } from '../musicxml/musicXmlPlaybackCache'
import { bufferToBase64 } from './songLibrary'

export type SupportedSongFileKind = 'midi' | 'musicxml'

export interface ImportedSongCandidate {
  kind: SupportedSongFileKind
  title: string
  originalFileName: string
  folderPath?: string
  midiData: string
  musicXmlData?: string
  playbackHash: string
  notationHash?: string
  duration: number
  trackCount: number
  noteCount: number
}

const MIDI_EXTENSION = /\.(mid|midi|rmi|rmid)$/i
const MUSIC_XML_EXTENSION = /\.(musicxml|xml)$/i

export function getSupportedSongFileKind(name: string): SupportedSongFileKind | null {
  if (MIDI_EXTENSION.test(name)) return 'midi'
  if (MUSIC_XML_EXTENSION.test(name)) return 'musicxml'
  return null
}

export function isSupportedSongFile(name: string) {
  return getSupportedSongFileKind(name) !== null
}

function stripSupportedExtension(name: string) {
  return name.replace(MIDI_EXTENSION, '').replace(MUSIC_XML_EXTENSION, '')
}

function normalizeMusicXmlText(text: string) {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
}

function arrayBufferFromView(view: Uint8Array) {
  const copy = new Uint8Array(view.byteLength)
  copy.set(view)
  return copy.buffer
}

function summarizeMidi(buffer: ArrayBuffer) {
  const midi = parseMidi(buffer)
  const notes = translateNotes(midi)
  return {
    midi,
    notes,
    duration: pulseToMicroseconds(midi.durationPulse, midi.header.ticksPerQuarter, buildTempoMap(midi)),
  }
}

export async function createImportedSongCandidate(file: File, folderPath?: string): Promise<ImportedSongCandidate> {
  const kind = getSupportedSongFileKind(file.name)
  if (!kind) throw new Error('Unsupported song file')

  const title = stripSupportedExtension(file.name)

  if (kind === 'midi') {
    const buffer = await file.arrayBuffer()
    const playbackHash = await computeMidiHash(buffer)
    const { midi, notes, duration } = summarizeMidi(buffer)
    return {
      kind,
      title,
      originalFileName: file.name,
      folderPath,
      midiData: bufferToBase64(buffer),
      playbackHash,
      duration,
      trackCount: midi.header.trackCount,
      noteCount: notes.length,
    }
  }

  const musicXmlData = normalizeMusicXmlText(await file.text())
  if (!isMusicXmlText(musicXmlData)) throw new SheetMusicError('sheetMusic.errors.invalidMusicXml', 'invalidMusicXml')

  const notationBytes = new TextEncoder().encode(musicXmlData)
  const notationHash = await computeMidiHash(arrayBufferFromView(notationBytes))
  const midiBuffer = await createMidiCacheFromMusicXml(musicXmlData)
  const playbackHash = await computeMidiHash(midiBuffer)
  const { midi, notes, duration } = summarizeMidi(midiBuffer)

  return {
    kind,
    title,
    originalFileName: file.name,
    folderPath,
    midiData: bufferToBase64(midiBuffer),
    musicXmlData,
    playbackHash,
    notationHash,
    duration,
    trackCount: midi.header.trackCount,
    noteCount: notes.length,
  }
}
