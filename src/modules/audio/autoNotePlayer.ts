import type { MidiDeviceInfo } from '../midi/webMidi'
import { isWebMidiSupported, requestMidiAccess, sendNote, sendProgramChange } from '../midi/webMidi'
import type { Hand, PlaySession, SessionNote } from '../game/playSession'
import { SimpleSynth } from './simpleSynth'
import { handMatches, isNoteInKeyboardRange } from '../game/hitDetection'
import { getInstrumentByProgram } from './gmInstrumentCatalog'
import { addActivePlaybackCounter, isPlaybackProfilerEnabled, setActivePlaybackGauge } from '../perf/playbackProfiler'

type MidiAccess = Awaited<ReturnType<typeof requestMidiAccess>>
interface ActivePitchEntry { hand: Hand; trackId: number }

function lowerBoundStart(notes: SessionNote[], startUs: number) {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (notes[mid].start < startUs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function notesSortedByStart(notes: SessionNote[]) {
  for (let index = 1; index < notes.length; index += 1) {
    if (notes[index].start < notes[index - 1].start) return false
  }
  return true
}

function maxNoteDurationUs(notes: SessionNote[]) {
  let maxDuration = 0
  for (const note of notes) maxDuration = Math.max(maxDuration, note.end - note.start)
  return maxDuration
}

export class AutoNotePlayer {
  private active = new Map<string, SessionNote>()
  private activeByPitch = new Map<number, ActivePitchEntry[]>()
  private activeKeyLights = new Map<string, { note: SessionNote; pitch: number }>()
  private synth = new SimpleSynth()
  private midiAccess: MidiAccess = null
  private midiOutputId = ''
  private usingSynth = false
  private zeroVolumeKeyLights = false
  private sentPrograms = new Map<number, number>()
  private sessionState: {
    session: PlaySession
    notes: SessionNote[]
    nextStartIndex: number
    nextControlChangeIndex: number
    maxDurationUs: number
    sortedByStart: boolean
    key: string
    lastUs: number
  } | null = null

  async configure(outputId: string, options?: { zeroVolumeKeyLights?: boolean }) {
    this.midiOutputId = outputId.trim()
    this.midiAccess = this.midiOutputId && isWebMidiSupported() ? await requestMidiAccess() : null
    this.usingSynth = !this.midiOutputId || !this.midiAccess?.outputs.get(this.midiOutputId)
    this.zeroVolumeKeyLights = !this.usingSynth && (options?.zeroVolumeKeyLights ?? false)
    this.sentPrograms.clear()
    this.clearKeyLights()
    if (this.usingSynth) await this.synth.start()
  }

  tick(session: PlaySession) {
    if (!session.setupComplete) return
    const profileEnabled = isPlaybackProfilerEnabled()
    let scannedNotes = 0
    let activatedNotes = 0
    let deactivatedNotes = 0
    this.currentSession = session
    const trackLookup = new Map(session.tracks.map(track => [track.trackId, track]))
    const shouldAutoPlay = (note: SessionNote) => {
      const track = trackLookup.get(note.trackId)
      if (!track || track.mode === 'notPlayed' || track.mode === 'playedButHidden') return false
      if (session.mode === 'listen') return true
      if (track.mode === 'playedAutomatically') return true
      if (track.mode === 'youPlay' && !isNoteInKeyboardRange(note, session)) return true
      if (track.mode === 'youPlay' && session.handSelection !== 'both' && !handMatches(session.handSelection, note)) return true
      return false
    }
    // Notes the player must play (youPlay + matching hand) — sent with velocity=0 as LED guides
    const shouldKeyLight = this.zeroVolumeKeyLights
      ? (note: SessionNote) => {
          const track = trackLookup.get(note.trackId)
          if (!track || track.mode !== 'youPlay') return false
          if (!isNoteInKeyboardRange(note, session)) return false
          if (session.mode === 'listen') return false
          // both-hands mode: guide both hands
          if (session.handSelection === 'both') return true
          // single-hand mode: guide only the hand being played
          return handMatches(session.handSelection, note)
        }
      : (_note: SessionNote) => false

    const autoKey = [
      session.mode,
      session.handSelection,
      session.keyboardRange ? `${session.keyboardRange.lowNote}:${session.keyboardRange.highNote}` : '',
      session.tracks.map(track => `${track.trackId}:${track.mode}`).join('|'),
    ].join('|')
    let state = this.sessionState
    if (!state || state.session !== session || state.notes !== session.notes || state.key !== autoKey || state.lastUs > session.currentUs) {
      state = {
        session,
        notes: session.notes,
        nextStartIndex: 0,
        nextControlChangeIndex: 0,
        maxDurationUs: maxNoteDurationUs(session.notes),
        sortedByStart: notesSortedByStart(session.notes),
        key: autoKey,
        lastUs: session.currentUs,
      }
      this.sessionState = state
    }

    if (!state.sortedByStart) {
      for (const note of session.notes) {
        scannedNotes += 1
        const wasActive = this.active.has(note.id)
        this.syncNote(session, note, shouldAutoPlay(note) && note.start <= session.currentUs && note.end > session.currentUs)
        const isActive = this.active.has(note.id)
        if (!wasActive && isActive) activatedNotes += 1
        else if (wasActive && !isActive) deactivatedNotes += 1
        this.syncKeyLight(note, shouldKeyLight(note) && note.start <= session.currentUs && note.end > session.currentUs)
      }
      state.lastUs = session.currentUs
      if (profileEnabled) {
        addActivePlaybackCounter('simulation', 'autoPlayerScanned', scannedNotes)
        addActivePlaybackCounter('simulation', 'autoPlayerActivated', activatedNotes)
        addActivePlaybackCounter('simulation', 'autoPlayerDeactivated', deactivatedNotes)
        setActivePlaybackGauge('simulation', 'autoPlayerActiveNotes', this.active.size)
        setActivePlaybackGauge('simulation', 'autoPlayerUsedFallbackFullScan', 1)
        setActivePlaybackGauge('simulation', 'autoPlayerMaxDurationUs', state.maxDurationUs)
      }
      return
    }

    for (const note of [...this.active.values()]) {
      if (note.end <= session.currentUs || !shouldAutoPlay(note)) {
        const wasActive = this.active.has(note.id)
        this.syncNote(session, note, false)
        if (wasActive && !this.active.has(note.id)) deactivatedNotes += 1
      }
    }
    for (const entry of [...this.activeKeyLights.values()]) {
      if (entry.note.end <= session.currentUs || !shouldKeyLight(entry.note)) this.syncKeyLight(entry.note, false)
    }

    const nextStartIndexBefore = state.nextStartIndex
    const fromIndex = Math.min(state.nextStartIndex, lowerBoundStart(session.notes, session.currentUs - state.maxDurationUs))
    let index = fromIndex
    while (index < session.notes.length) {
      const note = session.notes[index]
      if (note.start > session.currentUs) break
      scannedNotes += 1
      if (note.end > session.currentUs) {
        if (shouldAutoPlay(note)) {
          const wasActive = this.active.has(note.id)
          this.syncNote(session, note, true)
          if (!wasActive && this.active.has(note.id)) activatedNotes += 1
        }
        this.syncKeyLight(note, shouldKeyLight(note))
      }
      index += 1
    }
    state.nextStartIndex = Math.max(state.nextStartIndex, index)
    state.lastUs = session.currentUs
    if (profileEnabled) {
      addActivePlaybackCounter('simulation', 'autoPlayerScanned', scannedNotes)
      addActivePlaybackCounter('simulation', 'autoPlayerActivated', activatedNotes)
      addActivePlaybackCounter('simulation', 'autoPlayerDeactivated', deactivatedNotes)
      setActivePlaybackGauge('simulation', 'autoPlayerActiveNotes', this.active.size)
      setActivePlaybackGauge('simulation', 'autoPlayerMaxDurationUs', state.maxDurationUs)
      setActivePlaybackGauge('simulation', 'autoPlayerFromIndex', fromIndex)
      setActivePlaybackGauge('simulation', 'autoPlayerNextStartIndexBefore', nextStartIndexBefore)
      setActivePlaybackGauge('simulation', 'autoPlayerNextStartIndexAfter', state.nextStartIndex)
      setActivePlaybackGauge('simulation', 'autoPlayerUsedFallbackFullScan', 0)
    }
  }

  private _keyLightNoteIds = new Set<number>()
  private lightPitchSentAtMs = new Map<number, number>()

  /** Nhận diện note-on do đàn echo lại tín hiệu đèn hướng dẫn (velocity=1, mới gửi gần đây)
   * để không tính nhầm thành phím người chơi bấm. */
  isKeyLightEcho(note: number, velocity: number, nowMs = performance.now()): boolean {
    if (velocity > 1) return false
    const sentAtMs = this.lightPitchSentAtMs.get(note)
    return sentAtMs !== undefined && nowMs - sentAtMs < 300 && this._keyLightNoteIds.has(note)
  }

  allNotesOff(session?: PlaySession | null) {
    const hadActiveNotes = this.active.size > 0
    for (const note of this.active.values()) this.noteOff(note)
    this.clearKeyLights()
    if (session) {
      session.autoActiveNotes.clear()
      session.autoActiveNoteHands.clear()
      session.autoActiveNoteTrackIds.clear()
      session.autoActiveNotePressCounts.clear()
      if (hadActiveNotes) session.keyboardVisualVersion += 1
    }
    this.active.clear()
    this.activeByPitch.clear()
    this.currentSession = null
    this.sessionState = null
    this.synth.allNotesOff()
  }

  private clearKeyLights() {
    for (const entry of this.activeKeyLights.values()) this.noteOffKeyLight(entry.note, entry.pitch)
    this.activeKeyLights.clear()
    this._keyLightNoteIds.clear()
    this.lightPitchSentAtMs.clear()
  }

  /** Gửi key light ngay lập tức cho danh sách nốt cho trước.
   * Dùng trong noteMemory mode: khi clock dừng chờ player, tick() không còn được gọi,
   * nên cần chủ động gửi guide light cho chord đang chờ. */
  sendKeyLightsForNotes(notes: SessionNote[]) {
    if (!this.zeroVolumeKeyLights) return
    for (const note of notes) this.syncKeyLight(note, true)
  }

  /** Tắt key light cho danh sách nốt cho trước (gọi khi player đã bấm xong chord). */
  clearKeyLightsForNotes(notes: SessionNote[]) {
    for (const note of notes) this.syncKeyLight(note, false)
  }

  /** Gửi note-off cho toàn bộ 128 phím (trên tất cả 16 channels) tới hardware để tắt mọi đèn LED có thể bị kẹt. */
  clearAllHardwareKeyLights() {
    if (this.usingSynth || !this.midiAccess || !this.midiOutputId) return
    // Gửi note-off cho tất cả 128 notes trên tất cả 16 channels
    for (let channel = 0; channel < 16; channel++) {
      for (let note = 0; note < 128; note++) {
        sendNote(this.midiAccess, this.midiOutputId, note, 0, false, channel)
      }
    }
  }


  private syncNote(session: PlaySession, note: SessionNote, activeNow: boolean) {
    const key = note.id
    if (activeNow && !this.active.has(key)) {
      this.active.set(key, note)
      this.addAutoActiveNote(session, note.noteId, note.hand, note.trackId)
      this.noteOn(note)
    } else if (!activeNow && this.active.has(key)) {
      this.active.delete(key)
      this.removeAutoActiveNote(session, note.noteId)
      this.noteOff(note)
    }
  }

  private addAutoActiveNote(session: PlaySession, noteId: number, hand: Hand, trackId: number) {
    const entries = this.activeByPitch.get(noteId) ?? []
    entries.push({ hand, trackId })
    this.activeByPitch.set(noteId, entries)
    session.autoActiveNotePressCounts.set(noteId, (session.autoActiveNotePressCounts.get(noteId) ?? 0) + 1)
    session.autoActiveNotes.add(noteId)
    session.autoActiveNoteHands.set(noteId, hand)
    session.autoActiveNoteTrackIds.set(noteId, trackId)
    session.keyboardVisualVersion += 1
  }

  private removeAutoActiveNote(session: PlaySession, noteId: number) {
    const entries = this.activeByPitch.get(noteId) ?? []
    entries.pop()
    const current = entries[entries.length - 1]
    if (!current) {
      this.activeByPitch.delete(noteId)
      session.autoActiveNotes.delete(noteId)
      session.autoActiveNoteHands.delete(noteId)
      session.autoActiveNoteTrackIds.delete(noteId)
      session.keyboardVisualVersion += 1
      return
    }
    this.activeByPitch.set(noteId, entries)
    session.autoActiveNoteHands.set(noteId, current.hand)
    session.autoActiveNoteTrackIds.set(noteId, current.trackId)
    session.keyboardVisualVersion += 1
  }

  private noteOn(note: SessionNote) {
    const sessionTrack = this.currentTrackFor(note)
    const instrument = getInstrumentByProgram(sessionTrack?.instrumentProgram)
    if (this.usingSynth) {
      void this.synth.noteOn(note.id, note.noteId, note.velocity, instrument.soundfontId)
      return
    }
    const channel = note.channel ?? 0
    if (this.sentPrograms.get(channel) !== instrument.program) {
      sendProgramChange(this.midiAccess, this.midiOutputId, channel, instrument.program)
      this.sentPrograms.set(channel, instrument.program)
    }
    sendNote(this.midiAccess, this.midiOutputId, note.noteId, note.velocity || 80, true, channel)
  }

  private noteOff(note: SessionNote) {
    if (this.usingSynth) this.synth.noteOff(note.id)
    else sendNote(this.midiAccess, this.midiOutputId, note.noteId, 0, false, note.channel ?? 0)
  }

  private syncKeyLight(note: SessionNote, activeNow: boolean) {
    const key = note.id
    if (activeNow && !this.activeKeyLights.has(key)) {
      // Đèn phải sáng đúng phím vật lý người chơi bấm (tính cả octaveShift)
      const pitch = note.noteId + (this.currentSession?.octaveShift ?? 0) * 12
      this.activeKeyLights.set(key, { note, pitch })
      this._keyLightNoteIds.add(pitch)
      this.lightPitchSentAtMs.set(pitch, performance.now())
      this.noteOnKeyLight(note, pitch)
    } else if (!activeNow && this.activeKeyLights.has(key)) {
      const entry = this.activeKeyLights.get(key)!  // ponytail: giữ note-off đúng pitch đã gửi ngay cả khi currentSession đổi
      this.activeKeyLights.delete(key)
      this.lightPitchSentAtMs.delete(entry.pitch)
      // chỉ xóa khỏi set khi không còn key light nào khác cùng pitch
      if (![...this.activeKeyLights.values()].some(e => e.note.noteId === note.noteId)) {
        this._keyLightNoteIds.delete(entry.pitch)
      }
      this.noteOffKeyLight(note, entry.pitch)
    }
  }

  private noteOnKeyLight(note: SessionNote, pitch: number) {
    // velocity=0 trong note-on = note-off theo chuẩn MIDI; dùng 1 để phím thực sự sáng
    sendNote(this.midiAccess, this.midiOutputId, pitch, 1, true, note.channel ?? 0)
  }

  private noteOffKeyLight(note: SessionNote, pitch: number) {
    sendNote(this.midiAccess, this.midiOutputId, pitch, 0, false, note.channel ?? 0)
  }

  private currentSession: PlaySession | null = null

  private currentTrackFor(note: SessionNote) {
    return this.currentSession?.tracks.find(track => track.trackId === note.trackId)
  }
}

export type { MidiDeviceInfo }
