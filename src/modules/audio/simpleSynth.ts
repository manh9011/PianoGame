import type * as Soundfont from 'soundfont-player'
import { getInstrumentByProgram } from './gmInstrumentCatalog'

interface PlayingNote { stop: (when?: number) => unknown }
interface FallbackVoice { oscillator: OscillatorNode; gain: GainNode }

export class SimpleSynth {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private instruments = new Map<string, Soundfont.Player>()
  private loading = new Map<string, Promise<Soundfont.Player>>()
  private failedInstruments = new Set<string>()
  private cancelled = new Set<string>()
  private active = new Map<string, PlayingNote>()
  private fallbackActive = new Map<string, FallbackVoice>()

  async start() {
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = 0.72
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') await this.context.resume()
    await this.loadInstrument(getInstrumentByProgram(0).soundfontId)
  }

  async noteOn(voiceIdOrNoteId: string | number, noteIdOrVelocity?: number, velocityOrInstrument = 80, instrumentId?: string) {
    const legacyCall = typeof voiceIdOrNoteId === 'number'
    const voiceId = legacyCall ? String(voiceIdOrNoteId) : voiceIdOrNoteId
    const noteId = legacyCall ? voiceIdOrNoteId : noteIdOrVelocity ?? 0
    const velocity = legacyCall ? noteIdOrVelocity ?? 80 : velocityOrInstrument
    const soundfontId = instrumentId ?? getInstrumentByProgram(0).soundfontId

    if (!this.context || !this.master || this.active.has(voiceId) || this.fallbackActive.has(voiceId)) return
    this.cancelled.delete(voiceId)

    const instrument = await this.loadInstrument(soundfontId)
    if (this.cancelled.has(voiceId)) {
      this.cancelled.delete(voiceId)
      return
    }
    if (!instrument) {
      this.fallbackNoteOn(voiceId, noteId, velocity)
      return
    }

    const gain = Math.min(1, Math.max(0.08, velocity / 127))
    const note = instrument.play(String(noteId), this.context.currentTime, {
      gain,
      attack: 0.002,
      decay: 0.18,
      sustain: 0.72,
      release: 0.55,
    }) as unknown as PlayingNote
    this.active.set(voiceId, note)
  }

  noteOff(voiceIdOrNoteId: string | number) {
    const voiceId = String(voiceIdOrNoteId)
    const note = this.active.get(voiceId)
    if (note && this.context) {
      note.stop(this.context.currentTime + 0.08)
      this.active.delete(voiceId)
      return
    }
    this.cancelled.add(voiceId)
    this.fallbackNoteOff(voiceId)
  }

  allNotesOff() {
    for (const voiceId of [...this.active.keys()]) this.noteOff(voiceId)
    for (const voiceId of [...this.fallbackActive.keys()]) this.fallbackNoteOff(voiceId)
  }

  private async loadInstrument(soundfontId: string) {
    if (!this.context || !this.master || this.failedInstruments.has(soundfontId)) return null
    const cached = this.instruments.get(soundfontId)
    if (cached) return cached

    const loading = this.loading.get(soundfontId) ?? (async () => {
      const sf = await import('soundfont-player')
      return sf.instrument(this.context!, soundfontId as any, {
        soundfont: 'FluidR3_GM',
        format: 'mp3',
        destination: this.master!,
        gain: 1,
      })
    })()
    this.loading.set(soundfontId, loading)

    try {
      const instrument = await loading
      this.instruments.set(soundfontId, instrument)
      return instrument
    } catch (error) {
      console.warn(`Không tải được soundfont ${soundfontId}, dùng synth dự phòng.`, error)
      this.failedInstruments.add(soundfontId)
      return null
    }
  }

  private fallbackNoteOn(voiceId: string, noteId: number, velocity = 80) {
    if (!this.context || !this.master || this.fallbackActive.has(voiceId)) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = midiToFrequency(noteId)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(Math.max(0.03, velocity / 127) * 0.18, now + 0.01)
    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start(now)
    this.fallbackActive.set(voiceId, { oscillator, gain })
  }

  private fallbackNoteOff(voiceId: string) {
    const voice = this.fallbackActive.get(voiceId)
    if (!voice || !this.context) return
    const now = this.context.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
    voice.gain.gain.linearRampToValueAtTime(0.0001, now + 0.08)
    voice.oscillator.stop(now + 0.09)
    this.fallbackActive.delete(voiceId)
  }
}

export function midiToFrequency(noteId: number) {
  return 440 * 2 ** ((noteId - 69) / 12)
}
