import { parseMidi } from '../midi/midiParser'
import { pairMidiNotes } from '../midi/midiNotePairs'
import { requestMidiAccess, sendNote, sendProgramChange } from '../midi/webMidi'
import { getInstrumentByProgram } from './gmInstrumentCatalog'
import { SimpleSynth } from './simpleSynth'

export interface MidiAssetPlayback {
  durationMs: number
}

export interface MidiAssetPlayOptions {
  url: string
  midiOutputId?: string
  synth?: SimpleSynth
}

type MidiAccess = Awaited<ReturnType<typeof requestMidiAccess>>

interface ActiveMidiNote {
  access: MidiAccess
  outputId: string
  noteId: number
  channel: number
}

export class MidiAssetPlayer {
  private synth = new SimpleSynth()
  private activeSynth: SimpleSynth | null = null
  private timers: number[] = []
  private activeSynthVoices = new Set<string>()
  private activeMidiNotes: ActiveMidiNote[] = []
  private runId = 0
  private stopped = true

  async play(optionsOrUrl: MidiAssetPlayOptions | string): Promise<MidiAssetPlayback> {
    const options = typeof optionsOrUrl === 'string' ? { url: optionsOrUrl } : optionsOrUrl
    this.stop()
    const runId = ++this.runId
    this.stopped = false

    const response = await fetch(options.url)
    if (!response.ok) throw new Error(`Không tải được MIDI asset: ${response.status}`)

    const midi = parseMidi(await response.arrayBuffer())
    const notes = pairMidiNotes(midi)
    const durationMs = notes.reduce((max, note) => Math.max(max, note.endUs / 1000), 0)
    if (this.isStale(runId) || !notes.length) return { durationMs }

    const synth = options.synth ?? this.synth
    this.activeSynth = synth
    await synth.start()
    if (this.isStale(runId)) {
      this.stopSynthVoices(synth)
      return { durationMs }
    }

    const midiOutputId = options.midiOutputId?.trim()
    const midiAccess = midiOutputId ? await requestMidiAccess().catch(() => null) : null
    const hasMidiOutput = !!midiOutputId && !!midiAccess?.outputs.get(midiOutputId)
    if (this.isStale(runId)) {
      this.stopSynthVoices(synth)
      return { durationMs }
    }

    const trackInstruments = new Map(midi.tracks.map(track => [track.trackId, getInstrumentByProgram(track.instrumentProgram).soundfontId]))
    if (hasMidiOutput && midiOutputId) {
      const channelPrograms = new Map<number, number>()
      midi.tracks.forEach(track => {
        if (!channelPrograms.has(track.channel)) channelPrograms.set(track.channel, track.instrumentProgram)
      })
      channelPrograms.forEach((program, channel) => sendProgramChange(midiAccess, midiOutputId, channel, program))
    }

    notes.forEach((note, index) => {
      const voiceId = `asset-${runId}-${index}-${note.id}`
      const startMs = Math.max(0, note.startUs / 1000)
      const endMs = Math.max(startMs, note.endUs / 1000)
      const instrumentId = trackInstruments.get(note.trackId)

      this.timers.push(window.setTimeout(() => {
        if (this.isStale(runId)) return
        this.activeSynthVoices.add(voiceId)
        void synth.noteOn(voiceId, note.noteId, note.velocity, instrumentId)
        if (hasMidiOutput && midiOutputId) {
          this.activeMidiNotes.push({ access: midiAccess, outputId: midiOutputId, noteId: note.noteId, channel: note.channel })
          sendNote(midiAccess, midiOutputId, note.noteId, note.velocity, true, note.channel)
        }
      }, startMs))

      this.timers.push(window.setTimeout(() => {
        if (this.isStale(runId)) return
        synth.noteOff(voiceId)
        this.activeSynthVoices.delete(voiceId)
        if (hasMidiOutput && midiOutputId) {
          sendNote(midiAccess, midiOutputId, note.noteId, 0, false, note.channel)
          this.removeActiveMidiNote(midiOutputId, note.noteId, note.channel)
        }
      }, endMs))
    })

    return { durationMs }
  }

  stop() {
    this.runId += 1
    this.stopped = true
    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers = []
    if (this.activeSynth) this.stopSynthVoices(this.activeSynth)
    else this.synth.allNotesOff()
    this.stopMidiNotes()
  }

  private stopSynthVoices(synth: SimpleSynth) {
    for (const voiceId of this.activeSynthVoices) synth.noteOff(voiceId)
    this.activeSynthVoices.clear()
  }

  private stopMidiNotes() {
    for (const note of this.activeMidiNotes) sendNote(note.access, note.outputId, note.noteId, 0, false, note.channel)
    this.activeMidiNotes = []
  }

  private removeActiveMidiNote(outputId: string, noteId: number, channel: number) {
    const index = this.activeMidiNotes.findIndex(note => note.outputId === outputId && note.noteId === noteId && note.channel === channel)
    if (index >= 0) this.activeMidiNotes.splice(index, 1)
  }

  private isStale(runId: number) {
    return this.stopped || runId !== this.runId
  }
}
