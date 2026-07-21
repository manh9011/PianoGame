import { defineStore } from 'pinia'
import type { SongMetadata, SongSortKey, SortDirection } from '../types/song'
import { base64ToBuffer, bufferToBase64, loadLibrary, saveLibrary, sortSongs, loadSongData } from '../modules/library/songLibrary'
import { persistQueue } from '../modules/storage/indexedDb'
import { parseMidi } from '../modules/midi/midiParser'
import { translateNotes } from '../modules/midi/midiNoteTranslator'
import { buildTempoMap, pulseToMicroseconds } from '../modules/midi/midiTempo'
import { createDefaultTrackProperties } from '../modules/game/trackProperties'
import { PLAY_MODE_CONFIGS, createPlaySession, type PlaySession } from '../modules/game/playSession'
import { MidiPlayerClock } from '../modules/midi/midiPlayerClock'
import { assignHands } from '../modules/game/handAssignment'
import { AutoNotePlayer } from '../modules/audio/autoNotePlayer'
import { computeMidiHash } from '../modules/midi/midiHash'

export interface ImportResult {
  imported: number
  failed: { name: string; reason: string }[]
}

function ratingValue(value: number | undefined) {
  if (!value) return undefined
  return Math.max(1, Math.min(5, Math.round(value)))
}

function difficultyValue(value: number | undefined) {
  if (!value) return undefined
  return Math.max(1, Math.min(10, Math.round(value)))
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    songs: [] as SongMetadata[],
    loading: false,
    initialized: false,
    sortKey: 'title' as SongSortKey,
    sortDirection: 'asc' as SortDirection,
    searchQuery: '',
    selectedSongId: null as string | null,
    previewClock: null as MidiPlayerClock | null,
    previewSession: null as PlaySession | null,
    previewPlayer: new AutoNotePlayer(),
    previewSongId: null as string | null,
    previewProgress: 0,
    previewCurrentUs: 0,
    previewRunning: false,
    previewDurationUs: 0,
    previewRequestId: 0,
  }),
  getters: {
    filteredSongs(state): SongMetadata[] {
      const query = state.searchQuery.trim().toLowerCase()
      if (!query) return state.songs
      return state.songs.filter(song => [
        song.title,
        song.folderPath ?? '',
        String(song.bestScore),
        song.rating == null ? '' : String(song.rating),
        song.difficulty == null ? '' : String(song.difficulty),
      ].some(value => value.toLowerCase().includes(query)))
    },
    sortedSongs(): SongMetadata[] { return sortSongs(this.filteredSongs, this.sortKey, this.sortDirection) },
    selectedSong(): SongMetadata | null {
      const selected = this.selectedSongId ? this.sortedSongs.find(song => song.id === this.selectedSongId) : null
      return selected ?? this.sortedSongs[0] ?? null
    },
    songByHash(): (hash: string | undefined) => SongMetadata | null {
      return (hash: string | undefined) => {
        if (!hash) return null
        return this.songs.find(song => song.hash === hash) ?? null
      }
    },
  },
  actions: {
    async hydrate() {
      if (this.initialized) return
      this.loading = true
      try {
        this.songs = await loadLibrary()
        this.initialized = true
        this.loading = false
      } catch (error) {
        console.error('[Library Store] Lỗi khi hydrate:', error)
        this.loading = false
      }
    },
    persist() {
      const songs = JSON.parse(JSON.stringify(this.songs))
      persistQueue.enqueue(() => saveLibrary(songs))
    },
    async importFile(file: File, folderPath?: string) {
      const buffer = await file.arrayBuffer()
      const hash = await computeMidiHash(buffer)
      const title = file.name.replace(/\.(mid|midi|rmi|rmid)$/i, '')
      const existingByHash = this.songs.find(s => s.hash === hash)
      const existingByTitle = this.songs.find(s => s.title === title)
      const existing = existingByHash ?? existingByTitle
      const midi = parseMidi(buffer)
      const notes = translateNotes(midi)
      const duration = pulseToMicroseconds(midi.durationPulse, midi.header.ticksPerQuarter, buildTempoMap(midi))
      const song: SongMetadata = {
        id: existing?.id ?? crypto.randomUUID?.() ?? `${file.name}-${Date.now()}`,
        title,
        duration,
        trackCount: midi.header.trackCount,
        noteCount: notes.length,
        bestScore: existing?.bestScore ?? 0,
        playCount: existing?.playCount ?? 0,
        lastPlayed: existing?.lastPlayed ?? 0,
        recent: existing?.recent ?? false,
        data: bufferToBase64(buffer),
        hash,
        rating: existing?.rating,
        difficulty: existing?.difficulty,
        folderPath: folderPath ?? existing?.folderPath,
      }
      this.songs = [song, ...this.songs.filter(s => s.id !== song.id && s.hash !== hash)]
      this.selectedSongId ??= song.id
      this.persist()
      return song
    },
    async importFiles(files: File[], folderPath?: string): Promise<ImportResult> {
      const result: ImportResult = { imported: 0, failed: [] }
      for (const file of files) {
        try {
          await this.importFile(file, folderPath)
          result.imported++
        } catch (e) {
          result.failed.push({ name: file.name, reason: e instanceof Error ? e.message : 'Không import được MIDI' })
        }
      }
      return result
    },
    updateAfterPlay(id: string, score: number) { const song = this.songs.find(s => s.id === id); if (!song) return; song.playCount++; song.lastPlayed = Date.now(); song.recent = true; song.bestScore = Math.max(song.bestScore, score); this.persist() },
    setSearch(query: string) {
      this.searchQuery = query
      if (this.selectedSongId && !this.sortedSongs.some(song => song.id === this.selectedSongId)) {
        this.selectedSongId = this.sortedSongs[0]?.id ?? null
      }
    },
    selectSong(id: string) {
      this.selectedSongId = id
      if (this.previewSongId && this.previewSongId !== id) this.stopPreview()
    },
    setSort(key: SongSortKey) {
      if (this.sortKey === key) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
        return
      }
      this.sortKey = key
      this.sortDirection = key === 'title' ? 'asc' : 'desc'
    },
    renameSong(id: string, rawTitle: string) {
      const title = rawTitle.trim()
      const song = this.songs.find(s => s.id === id)
      if (!song || !title) return false
      if (song.title === title) return true
      song.title = title
      this.persist()
      return true
    },
    updateSongPreferences(id: string, values: { rating?: number; difficulty?: number }) {
      const song = this.songs.find(s => s.id === id)
      if (!song) return
      if ('rating' in values) song.rating = ratingValue(values.rating)
      if ('difficulty' in values) song.difficulty = difficultyValue(values.difficulty)
      this.persist()
    },
    async startPreview(song: SongMetadata, outputId: string, speed: number, showDuration: number, octaveShift: number) {
      const requestId = this.previewRequestId + 1
      this.previewRequestId = requestId
      const isCurrentRequest = () => this.previewRequestId === requestId
      const data = song.data ?? await loadSongData(song.id)
      if (!data || !isCurrentRequest()) return
      this.stopPreview()
      this.previewRequestId = requestId
      await this.previewPlayer.configure(outputId)
      if (!isCurrentRequest()) return
      const midi = parseMidi(base64ToBuffer(data))
      if (!isCurrentRequest()) return
      const { notes } = assignHands(translateNotes(midi))
      const trackIds = [...new Set(notes.map(note => note.trackId))]
      const tracks = createDefaultTrackProperties(trackIds)
      const duration = pulseToMicroseconds(midi.durationPulse, midi.header.ticksPerQuarter, buildTempoMap(midi))
      const session = createPlaySession(notes, tracks, { speed, showDuration, octaveShift })
      session.mode = 'listen'
      session.modeConfig = PLAY_MODE_CONFIGS.listen
      session.handSelection = 'both'
      session.setupComplete = true
      session.paused = false
      session.tracks.forEach(track => { track.mode = 'playedAutomatically' })
      if (!isCurrentRequest()) return
      this.previewSession = session
      this.previewSongId = song.id
      this.previewDurationUs = duration
      this.previewClock = new MidiPlayerClock(duration, () => speed, state => {
        if (!isCurrentRequest()) return
        const previewSession = this.previewSession
        if (!previewSession) return
        previewSession.currentUs = state.currentUs
        previewSession.finished = state.finished
        previewSession.paused = !state.running
        this.previewProgress = state.progress
        this.previewCurrentUs = Math.max(0, state.currentUs)
        this.previewRunning = state.running && !state.finished
        this.previewPlayer.tick(previewSession)
        if (state.finished) this.stopPreview()
      })
      this.previewClock.seek(0)
      this.previewClock.start()
      this.previewRunning = true
    },
    async togglePreview(song: SongMetadata | null, outputId: string, speed: number, showDuration: number, octaveShift: number) {
      if (!song) return
      if (this.previewSongId === song.id && this.previewClock) {
        if (this.previewRunning) this.pausePreview()
        else {
          this.previewClock.start()
          if (this.previewSession) this.previewSession.paused = false
          this.previewRunning = true
        }
        return
      }
      await this.startPreview(song, outputId, speed, showDuration, octaveShift)
    },
    pausePreview() {
      this.previewClock?.pause()
      this.previewPlayer.allNotesOff(this.previewSession)
      if (this.previewSession) this.previewSession.paused = true
      this.previewRunning = false
    },
    stopPreview() {
      this.previewRequestId++
      this.previewClock?.stop()
      this.previewPlayer.allNotesOff(this.previewSession)
      this.previewClock = null
      this.previewSession = null
      this.previewSongId = null
      this.previewProgress = 0
      this.previewCurrentUs = 0
      this.previewRunning = false
      this.previewDurationUs = 0
    },
    seekPreviewToProgress(ratio: number) {
      if (!this.previewClock) return
      const clamped = Math.max(0, Math.min(1, ratio))
      this.previewPlayer.allNotesOff(this.previewSession)
      this.previewClock.seek(clamped * this.previewClock.seekableDurationUs)
    },
    deleteSong(id: string) {
      if (this.previewSongId === id) this.stopPreview()
      this.songs = this.songs.filter(s => s.id !== id)
      if (this.selectedSongId === id) this.selectedSongId = this.sortedSongs[0]?.id ?? null
      this.persist()
    },
  },
})
