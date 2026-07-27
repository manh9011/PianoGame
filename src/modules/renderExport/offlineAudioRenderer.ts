import { getInstrumentByProgram } from '../audio/gmInstrumentCatalog'
import { LEAD_IN_US } from '../midi/midiPlayerClock'
import type { RenderedAudioPayload, RenderExportRequest } from './exportTypes'

export interface AudioBufferLike {
  length: number
  numberOfChannels: number
  getChannelData(channel: number): Float32Array
}

export interface OfflineAudioRenderResult {
  audioBuffer: AudioBufferLike
  sampleRate: number
}

const RELEASE_SEC = 0.12
const ATTACK_SEC = 0.006
const TWO_PI = Math.PI * 2



export function renderStartUs(request: RenderExportRequest) {
  return request.cropStartUs <= 0 ? -LEAD_IN_US : request.cropStartUs
}

export function renderEndUs(request: RenderExportRequest) {
  if (!request.preset.endsWith('10s')) return request.cropEndUs
  return Math.min(request.cropEndUs, renderStartUs(request) + 10_000_000)
}

export function createAudioBufferLike(channels: Float32Array[]): AudioBufferLike {
  return {
    length: channels[0]?.length ?? 0,
    numberOfChannels: channels.length,
    getChannelData(channel: number) {
      return channels[channel] ?? channels[0]
    },
  }
}

export function visibleTracks(request: RenderExportRequest) {
  return request.scene.tracks.filter(track =>
    track.mode !== 'notPlayed' &&
    track.mode !== 'playedButHidden' &&
    track.color !== 'transparent'
  )
}

function visibleTrackIds(request: RenderExportRequest) {
  return new Set(visibleTracks(request).map(track => track.trackId))
}

function envelopeAt(timeSec: number, noteStartSec: number, noteEndSec: number) {
  if (timeSec < noteStartSec || timeSec > noteEndSec + RELEASE_SEC) return 0
  if (timeSec < noteStartSec + ATTACK_SEC) return Math.max(0, (timeSec - noteStartSec) / ATTACK_SEC)
  if (timeSec <= noteEndSec) return 1
  return Math.max(0, 1 - (timeSec - noteEndSec) / RELEASE_SEC)
}

function waveform(phase: number) {
  const sine = Math.sin(phase)
  const second = Math.sin(phase * 2) * 0.22
  const third = Math.sin(phase * 3) * 0.08
  return sine + second + third
}

function mixNote(channels: Float32Array[], sampleRate: number, durationSec: number, noteStartSec: number, noteEndSec: number, noteId: number, velocity: number) {
  const left = channels[0]
  const right = channels[1]
  const startFrame = Math.max(0, Math.floor(noteStartSec * sampleRate))
  const endFrame = Math.min(left.length, Math.ceil(Math.min(durationSec, noteEndSec + RELEASE_SEC) * sampleRate))
  if (endFrame <= startFrame) return

  const frequency = 440 * 2 ** ((noteId - 69) / 12)
  const gain = Math.max(0.02, Math.min(1, velocity / 127)) * 0.075
  const pan = Math.max(-0.35, Math.min(0.35, (noteId - 60) / 72))
  const leftGain = Math.cos((pan + 1) * Math.PI / 4)
  const rightGain = Math.sin((pan + 1) * Math.PI / 4)

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const timeSec = frame / sampleRate
    const env = envelopeAt(timeSec, noteStartSec, noteEndSec)
    if (env <= 0) continue
    const phase = TWO_PI * frequency * (timeSec - noteStartSec)
    const sample = waveform(phase) * gain * env
    left[frame] += sample * leftGain
    right[frame] += sample * rightGain
  }
}

function normalize(channels: Float32Array[]) {
  let peak = 0
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      peak = Math.max(peak, Math.abs(channel[index]))
    }
  }
  if (peak <= 0.98) return
  const scale = 0.98 / peak
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] *= scale
    }
  }
}

function applyFadeEdges(channels: Float32Array[], sampleRate: number) {
  const fadeFrames = Math.min(Math.floor(sampleRate * 0.02), Math.floor((channels[0]?.length ?? 0) / 2))
  if (fadeFrames <= 0) return
  for (const channel of channels) {
    for (let index = 0; index < fadeFrames; index += 1) {
      const gain = index / fadeFrames
      channel[index] *= gain
      channel[channel.length - 1 - index] *= gain
    }
  }
}

function renderPcmAudio(request: RenderExportRequest, durationSec: number, sampleRate: number): OfflineAudioRenderResult {
  const frameCount = Math.max(1, Math.ceil(durationSec * sampleRate))
  const channels = [new Float32Array(frameCount), new Float32Array(frameCount)]
  const startUs = renderStartUs(request)
  const endUs = renderEndUs(request)
  const tracks = visibleTrackIds(request)
  const outputGain = Math.max(0, Math.min(2, request.outputVolume / 100))

  for (const note of request.scene.notes) {
    if (!tracks.has(note.trackId)) continue
    if (note.endUs < startUs || note.startUs > endUs) continue
    const noteStartSec = Math.max(0, (note.startUs - startUs) / 1_000_000)
    const noteEndSec = Math.min(durationSec, (note.endUs - startUs) / 1_000_000)
    if (noteEndSec <= 0 || noteStartSec >= durationSec) continue
    mixNote(channels, sampleRate, durationSec, noteStartSec, Math.max(noteStartSec + 0.03, noteEndSec), note.noteId, note.velocity || 80)
  }

  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) channel[index] *= outputGain
  }
  applyFadeEdges(channels, sampleRate)
  normalize(channels)

  return { audioBuffer: createAudioBufferLike(channels), sampleRate }
}



export function packOfflineAudio(result: OfflineAudioRenderResult): RenderedAudioPayload {
  const channels: ArrayBuffer[] = []
  for (let channel = 0; channel < result.audioBuffer.numberOfChannels; channel += 1) {
    const copy = new Float32Array(result.audioBuffer.getChannelData(channel))
    channels.push(copy.buffer)
  }
  return {
    sampleRate: result.sampleRate,
    length: result.audioBuffer.length,
    numberOfChannels: result.audioBuffer.numberOfChannels,
    channels,
  }
}

export function unpackOfflineAudio(payload: RenderedAudioPayload): OfflineAudioRenderResult {
  const channels = payload.channels.map(channel => new Float32Array(channel))
  return {
    audioBuffer: createAudioBufferLike(channels),
    sampleRate: payload.sampleRate,
  }
}



export function renderFallbackPcmAudio(request: RenderExportRequest): OfflineAudioRenderResult {
  const durationUs = Math.max(0, renderEndUs(request) - renderStartUs(request))
  const durationSec = Math.max(0.1, durationUs / 1_000_000)
  const sampleRate = 48_000
  return renderPcmAudio(request, durationSec, sampleRate)
}
