import type * as Soundfont from 'soundfont-player'
import { getInstrumentByProgram } from '../audio/gmInstrumentCatalog'
import { soundfontNameToUrl } from '../audio/soundfontSource'
import type { RenderExportRequest } from './exportTypes'
import {
  type OfflineAudioRenderResult,
  createAudioBufferLike,
  renderEndUs,
  renderStartUs,
  visibleTracks,
} from './offlineAudioRenderer'

type SoundfontPlayer = Awaited<ReturnType<typeof import('soundfont-player').instrument>>
type OfflineAudioContextConstructor = typeof OfflineAudioContext

declare global {
  interface Window {
    webkitOfflineAudioContext?: OfflineAudioContextConstructor
  }
}

function midiToSoundfontNoteName(noteId: number) {
  const pitchClasses = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
  return `${pitchClasses[((noteId % 12) + 12) % 12]}${Math.floor(noteId / 12) - 1}`
}

async function loadSoundfontInstrument(context: OfflineAudioContext, master: GainNode, soundfontId: string, notes: string[]): Promise<SoundfontPlayer> {
  const sf = await import('soundfont-player')
  return await sf.instrument(context as unknown as AudioContext, soundfontId as any, {
    soundfont: 'FluidR3_GM',
    format: 'mp3',
    nameToUrl: soundfontNameToUrl,
    destination: master,
    gain: 1,
    notes,
  })
}

async function renderSoundfontAudioRange(request: RenderExportRequest, rangeStartUs: number, rangeEndUs: number, sampleRate: number): Promise<OfflineAudioRenderResult> {
  const OfflineContext = globalThis.OfflineAudioContext ?? (globalThis as typeof globalThis & { webkitOfflineAudioContext?: OfflineAudioContextConstructor }).webkitOfflineAudioContext
  if (!OfflineContext) throw new Error('OfflineAudioContext is not available.')

  const durationSec = Math.max(0.1, (rangeEndUs - rangeStartUs) / 1_000_000)
  const context = new OfflineContext(2, Math.ceil(durationSec * sampleRate), sampleRate)
  const master = context.createGain()
  master.gain.value = Math.max(0, Math.min(2, request.outputVolume / 100))
  master.connect(context.destination)

  const tracks = new Map(visibleTracks(request).map(track => [track.trackId, track]))
  const sortedNotes = request.scene.notes
    .filter(note => tracks.has(note.trackId) && note.endUs >= rangeStartUs && note.startUs <= rangeEndUs)
    .sort((a, b) => a.startUs - b.startUs || a.noteId - b.noteId)
  const notesByInstrument = new Map<string, Set<string>>()

  for (const note of sortedNotes) {
    const track = tracks.get(note.trackId)
    if (!track) continue
    const instrumentId = getInstrumentByProgram(track.instrumentProgram).soundfontId
    const notes = notesByInstrument.get(instrumentId) ?? new Set<string>()
    notes.add(midiToSoundfontNoteName(note.noteId))
    notesByInstrument.set(instrumentId, notes)
  }

  const instruments = new Map<string, SoundfontPlayer>()

  await Promise.all([...notesByInstrument.entries()].map(async ([soundfontId, notes]) => {
    instruments.set(soundfontId, await loadSoundfontInstrument(context, master, soundfontId, [...notes]))
  }))

  for (const note of sortedNotes) {
    const track = tracks.get(note.trackId)
    if (!track) continue
    const instrumentId = getInstrumentByProgram(track.instrumentProgram).soundfontId
    const instrument = instruments.get(instrumentId)
    if (!instrument) continue

    const startSec = Math.max(0, (note.startUs - rangeStartUs) / 1_000_000)
    const endSec = Math.min(durationSec, (note.endUs - rangeStartUs) / 1_000_000)
    const noteDurationSec = Math.max(0.03, endSec - startSec)
    if (startSec >= durationSec || endSec <= 0) continue

    instrument.play(midiToSoundfontNoteName(note.noteId), startSec, {
      duration: noteDurationSec,
      gain: Math.max(0.02, Math.min(1, (note.velocity || 80) / 127)),
    })
  }

  const audioBuffer = await context.startRendering()
  return { audioBuffer, sampleRate }
}

export interface RenderOfflineAudioOptions {
  onProgress?: (progress: number) => void
}

function copyRenderedAudioChunk(target: Float32Array[], chunk: OfflineAudioRenderResult, offsetFrames: number) {
  const frameCount = chunk.audioBuffer.length
  for (let channel = 0; channel < target.length; channel += 1) {
    const source = chunk.audioBuffer.getChannelData(Math.min(channel, chunk.audioBuffer.numberOfChannels - 1))
    target[channel].set(source.subarray(0, Math.min(source.length, target[channel].length - offsetFrames)), offsetFrames)
  }
}

export async function renderOfflineAudio(request: RenderExportRequest, options: RenderOfflineAudioOptions = {}): Promise<OfflineAudioRenderResult> {
  const startUs = renderStartUs(request)
  const endUs = renderEndUs(request)
  const durationUs = Math.max(0, endUs - startUs)
  const sampleRate = 48_000
  const frameCount = Math.max(1, Math.ceil((Math.max(0.1, durationUs / 1_000_000)) * sampleRate))
  const channels = [new Float32Array(frameCount), new Float32Array(frameCount)]
  const chunkUs = 30_000_000
  let chunkStartUs = startUs
  let chunkIndex = 0
  const totalChunks = Math.max(1, Math.ceil(durationUs / chunkUs))

  while (chunkStartUs < endUs || chunkIndex === 0) {
    const chunkEndUs = Math.min(endUs, chunkStartUs + chunkUs)
    const chunk = await renderSoundfontAudioRange(request, chunkStartUs, chunkEndUs, sampleRate)
    copyRenderedAudioChunk(channels, chunk, Math.round(((chunkStartUs - startUs) / 1_000_000) * sampleRate))
    chunkIndex += 1
    options.onProgress?.(chunkIndex / totalChunks)
    await new Promise(resolve => setTimeout(resolve, 0))
    if (chunkEndUs >= endUs) break
    chunkStartUs = chunkEndUs
  }

  return { audioBuffer: createAudioBufferLike(channels), sampleRate }
}
