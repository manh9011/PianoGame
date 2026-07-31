import { defineStore } from 'pinia'
import type { SongMetadata, SongSortKey, SortDirection } from '../types/song'
import { base64ToBuffer, deleteSongFromLibrary, loadLibrary, saveLibrary, sortSongs, loadSongCompressedMusicXmlData, loadSongMidiData, loadSongMusicXmlData, migrateSongIdInLibrary } from '../modules/library/songLibrary'
import { persistQueue, deleteRecord } from '../modules/storage/indexedDb'
import { useProfileStore } from './profileStore'
import { useSettingsStore } from './settingsStore'
import { parseMidi } from '../modules/midi/midiParser'
import { translateControlChanges, translateNotes } from '../modules/midi/midiNoteTranslator'
import { buildTempoMap, pulseToMicroseconds } from '../modules/midi/midiTempo'
import { createDefaultTrackProperties } from '../modules/game/trackProperties'
import { PLAY_MODE_CONFIGS, createPlaySession, type PlaySession } from '../modules/game/playSession'
import { MidiPlayerClock } from '../modules/midi/midiPlayerClock'
import { assignHands } from '../modules/game/handAssignment'
import { AutoNotePlayer } from '../modules/audio/autoNotePlayer'
import { createImportedSongCandidate, type ImportedSongCandidate } from '../modules/library/songImport'
import { evaluateMidiDifficultyAuto } from '../modules/midi/midiDifficulty'
import { supportsFileSystemAccess, rescanSongFilesFromFolder } from '../modules/library/fileSystemAccess'

export interface ImportResult {
  imported: number
  failed: { name: string; reason: string }[]
}

export interface DifficultyEvaluationProgress {
  current: number
  total: number
  song: SongMetadata
}

export interface DifficultyEvaluationResult {
  completed: number
  failed: { song: SongMetadata; reason: string }[]
}

function ratingValue(value: number | undefined) {
  if (!value) return undefined
  return Math.max(1, Math.min(5, Math.round(value)))
}

function difficultyValue(value: number | undefined) {
  if (!value) return undefined
  return Math.max(1, Math.min(10, Math.round(value)))
}

function playbackHash(song: SongMetadata) {
  return song.playbackHash ?? song.hash
}

function needsDifficultyEvaluation(song: SongMetadata) {
  return song.difficulty == null
}

function normalizeTitle(title: string) {
  return title
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_\-()[\]{}.,]+/g, ' ')
    .trim()
}

function closeEnough(value: number, target: number, toleranceRatio: number) {
  if (!value || !target) return false
  return Math.abs(value - target) <= Math.max(value, target) * toleranceRatio
}

function findMergeTarget(songs: SongMetadata[], candidate: ImportedSongCandidate) {
  const byPlaybackHash = songs.find(song => playbackHash(song) === candidate.playbackHash)
  if (byPlaybackHash) return byPlaybackHash

  const candidateTitle = normalizeTitle(candidate.title)
  const exactTitleMatches = songs.filter(song => normalizeTitle(song.title) === candidateTitle)
  if (exactTitleMatches.length === 1) return exactTitleMatches[0]

  const nearMatches = songs.filter(song => {
    const songTitle = normalizeTitle(song.title)
    const titleMatches = songTitle === candidateTitle || songTitle.includes(candidateTitle) || candidateTitle.includes(songTitle)
    return titleMatches && closeEnough(song.duration, candidate.duration, 0.05) && closeEnough(song.noteCount, candidate.noteCount, 0.12)
  })
  return nearMatches.length === 1 ? nearMatches[0] : undefined
}

function sourceTypeFor(existing: SongMetadata | undefined, candidate: ImportedSongCandidate) {
  const hasMidiSource = candidate.kind === 'midi' || existing?.hasMidiSource
  const hasMusicXmlSource = candidate.kind === 'musicxml' || existing?.hasMusicXmlSource
  if (hasMidiSource && hasMusicXmlSource) return 'hybrid'
  return hasMusicXmlSource ? 'musicxml' : 'midi'
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    songs: [] as SongMetadata[],
    loading: false,
    initialized: false,
    sortKey: 'title' as SongSortKey,
    sortDirection: 'asc' as SortDirection,
    sortTouched: false,
    searchQuery: '',
    selectedFolder: 'all' as string,
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
      let result = state.songs
      if (state.selectedFolder === 'imported') {
        result = result.filter(song => !song.folderPath)
      } else if (state.selectedFolder && state.selectedFolder !== 'all') {
        result = result.filter(song => song.folderPath === state.selectedFolder)
      }
      const query = state.searchQuery.trim().toLowerCase()
      if (!query) return result
      return result.filter(song => [
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
        return this.songs.find(song => playbackHash(song) === hash) ?? null
      }
    },
  },
  actions: {
    async hydrate() {
      if (this.initialized) return
      this.loading = true
      try {
        this.songs = await loadLibrary()

        const idMigrations = new Map<string, string>()
        let needsMigration = false
        for (const song of this.songs) {
          if (song.playbackHash && song.id !== song.playbackHash) {
            idMigrations.set(song.id, song.playbackHash)
            song.id = song.playbackHash
            needsMigration = true
          }
        }

        if (needsMigration) {
          await Promise.all(
            Array.from(idMigrations.entries()).map(([oldId, newId]) =>
              migrateSongIdInLibrary(oldId, newId)
            )
          )
          const profileStore = useProfileStore()
          await profileStore.hydrate()
          profileStore.migrateSongIds(idMigrations)
          await saveLibrary(this.songs)
        }

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
    async importFile(file: File, folderPath?: string, shouldPersist = true) {
      const candidate = await createImportedSongCandidate(file, folderPath)
      const importedAt = Date.now()
      const existing = findMergeTarget(this.songs, candidate)
      const existingMusicXmlData = existing?.musicXmlData ?? (existing?.hasMusicXmlSource ? await loadSongMusicXmlData(existing.id) : undefined)
      const existingCompressedMusicXmlData = existing?.compressedMusicXmlData ?? (existing?.hasMusicXmlSource ? await loadSongCompressedMusicXmlData(existing.id) : undefined)
      const song: SongMetadata = {
        id: existing?.id ?? candidate.playbackHash ?? crypto.randomUUID?.() ?? `${file.name}-${Date.now()}`,
        title: existing?.title ?? candidate.title,
        duration: candidate.duration,
        trackCount: candidate.trackCount,
        noteCount: candidate.noteCount,
        bestScore: existing?.bestScore ?? 0,
        playCount: existing?.playCount ?? 0,
        lastPlayed: existing?.lastPlayed ?? 0,
        importedAt,
        recent: existing?.recent ?? false,
        data: candidate.midiData,
        midiData: candidate.midiData,
        musicXmlData: candidate.musicXmlData ?? existingMusicXmlData,
        compressedMusicXmlData: candidate.compressedMusicXmlData ?? existingCompressedMusicXmlData,
        hash: candidate.playbackHash,
        playbackHash: candidate.playbackHash,
        notationHash: candidate.notationHash ?? existing?.notationHash,
        sourceType: sourceTypeFor(existing, candidate),
        hasMidiSource: candidate.kind === 'midi' || existing?.hasMidiSource || false,
        hasMusicXmlSource: candidate.kind === 'musicxml' || existing?.hasMusicXmlSource || false,
        originalFileName: candidate.originalFileName,
        rating: existing?.rating,
        difficulty: candidate.difficulty ?? existing?.difficulty,
        folderPath: folderPath ?? existing?.folderPath,
      }
      this.songs = [song, ...this.songs.filter(s => s.id !== song.id && playbackHash(s) !== candidate.playbackHash)]
      this.selectedSongId ??= song.id
      if (shouldPersist) {
        this.persist()
      }
      return song
    },
    async importFiles(files: File[], folderPath?: string, isBackground = false): Promise<ImportResult> {
      const result: ImportResult = { imported: 0, failed: [] }
      if (!files.length) return result

      // Fast lookup set of existing folder:filename pairs to skip redundant parsing
      const existingKeys = new Set(
        this.songs
          .filter(s => s.originalFileName)
          .map(s => `${s.folderPath || ''}:${s.originalFileName}`)
      )

      const filesToProcess: File[] = []
      for (const file of files) {
        const key = `${folderPath || ''}:${file.name}`
        if (existingKeys.has(key)) {
          continue
        }
        filesToProcess.push(file)
      }

      if (!filesToProcess.length) {
        return result
      }

      let processedInChunk = 0
      for (const file of filesToProcess) {
        try {
          await this.importFile(file, folderPath, false)
          result.imported++
          processedInChunk++

          if (isBackground) {
            // Background chill mode: pause 80ms per file so CPU load remains near 0%
            await new Promise(resolve => setTimeout(resolve, 80))
          } else if (processedInChunk % 2 === 0) {
            // Manual import mode: yield 16ms every 2 files
            await new Promise(resolve => setTimeout(resolve, 16))
          }
        } catch (e) {
          result.failed.push({ name: file.name, reason: e instanceof Error ? e.message : 'library.importUnsupportedFile' })
        }
      }

      if (result.imported > 0) {
        this.persist()
      }
      return result
    },
    async rescanFoldersOnStartup(folders: string[]): Promise<number> {
      if (!folders.length || !supportsFileSystemAccess()) return 0
      let totalImported = 0
      for (const folderName of folders) {
        try {
          const result = await rescanSongFilesFromFolder(folderName, false)
          if (result && result.files.length) {
            const importRes = await this.importFiles(result.files, result.name, true)
            totalImported += importRes.imported
          }
        } catch (e) {
          console.warn(`[Library Store] Startup rescan for folder "${folderName}" failed:`, e)
        }
      }
      return totalImported
    },
    updateAfterPlay(id: string, score: number) { const song = this.songs.find(s => s.id === id); if (!song) return; song.playCount++; song.lastPlayed = Date.now(); song.recent = true; song.bestScore = Math.max(song.bestScore, score); this.persist() },
    setSearch(query: string) {
      this.searchQuery = query
      if (this.selectedSongId && !this.sortedSongs.some(song => song.id === this.selectedSongId)) {
        this.selectedSongId = this.sortedSongs[0]?.id ?? null
      }
    },
    setSelectedFolder(folder: string) {
      this.selectedFolder = folder
      if (this.selectedSongId && !this.sortedSongs.some(song => song.id === this.selectedSongId)) {
        this.selectedSongId = this.sortedSongs[0]?.id ?? null
      }
    },
    selectSong(id: string) {
      this.selectedSongId = id
      if (this.previewSongId && this.previewSongId !== id) this.stopPreview()
    },
    setSort(key: SongSortKey) {
      this.sortTouched = true
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
    async evaluateSongDifficulty(id: string) {
      const song = this.songs.find(s => s.id === id)
      if (!song) throw new Error('library.songNotFound')
      const data = song.data ?? song.midiData ?? await loadSongMidiData(song.id)
      if (!data) throw new Error('sheetMusic.errors.missingMidiData')
      const result = evaluateMidiDifficultyAuto(base64ToBuffer(data))
      song.difficulty = difficultyValue(result.roundedScore)
      this.persist()
      return song.difficulty
    },
    async evaluateSongDifficulties(ids: string[], onProgress?: (progress: DifficultyEvaluationProgress) => void): Promise<DifficultyEvaluationResult> {
      const uniqueIds = [...new Set(ids)]
      const targets = uniqueIds
        .map(id => this.songs.find(song => song.id === id))
        .filter((song): song is SongMetadata => Boolean(song))
      const result: DifficultyEvaluationResult = { completed: 0, failed: [] }
      const total = targets.length

      for (const song of targets) {
        try {
          const data = song.data ?? song.midiData ?? await loadSongMidiData(song.id)
          if (!data) throw new Error('sheetMusic.errors.missingMidiData')
          const difficulty = evaluateMidiDifficultyAuto(base64ToBuffer(data)).roundedScore
          song.difficulty = difficultyValue(difficulty)
          result.completed++
        } catch (error) {
          result.failed.push({ song, reason: error instanceof Error ? error.message : String(error) })
        } finally {
          onProgress?.({ current: result.completed + result.failed.length, total, song })
        }
      }

      if (total > 0) this.persist()
      return result
    },
    async evaluateMissingSongDifficulties(onProgress?: (progress: DifficultyEvaluationProgress) => void) {
      return this.evaluateSongDifficulties(this.songs.filter(needsDifficultyEvaluation).map(song => song.id), onProgress)
    },
    async startPreview(song: SongMetadata, outputId: string, speed: number, showDuration: number, octaveShift: number) {
      const requestId = this.previewRequestId + 1
      this.previewRequestId = requestId
      const isCurrentRequest = () => this.previewRequestId === requestId
      const data = song.data ?? song.midiData ?? await loadSongMidiData(song.id)
      if (!data || !isCurrentRequest()) return
      this.stopPreview()
      this.previewRequestId = requestId
      await this.previewPlayer.configure(outputId)
      if (!isCurrentRequest()) return
      const midi = parseMidi(base64ToBuffer(data))
      if (!isCurrentRequest()) return
      const { notes } = assignHands(translateNotes(midi))
      const controlChanges = translateControlChanges(midi)
      const trackIds = [...new Set(notes.map(note => note.trackId))]
      const tracks = createDefaultTrackProperties(trackIds.map(trackId => {
        const info = midi.tracks.find(t => t.trackId === trackId)
        return {
          trackId,
          instrumentProgram: info?.instrumentProgram,
          percussion: Boolean(info?.isPercussion || info?.channel === 9),
        }
      }))
      const duration = pulseToMicroseconds(midi.durationPulse, midi.header.ticksPerQuarter, buildTempoMap(midi))
      const session = createPlaySession(notes, controlChanges, tracks, { speed, showDuration, octaveShift })
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

      // FIX: Tránh dùng chung một AutoNotePlayer instance dễ bị lỗi gc / treo qua nhiều tab chuyển đổi.
      // Luôn tạo mới player như bên playerStore.ts.
      this.previewPlayer = new AutoNotePlayer()
      await this.previewPlayer.configure(outputId)

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
    async deleteSong(id: string) {
      if (this.previewSongId === id) this.stopPreview()
      const previousSongs = this.songs
      const previousSelectedSongId = this.selectedSongId
      this.songs = this.songs.filter(s => s.id !== id)
      if (this.selectedSongId === id) this.selectedSongId = this.sortedSongs[0]?.id ?? null

      try {
        await persistQueue.run(() => deleteSongFromLibrary(id))
      } catch (error) {
        this.songs = previousSongs
        this.selectedSongId = previousSelectedSongId
        throw error
      }
    },
    async removeFolder(folderName: string) {
      const settings = useSettingsStore()
      settings.patchSettings({
        folders: settings.folders.filter(f => f !== folderName),
        ...(settings.lastSelectedFolder === folderName ? { lastSelectedFolder: 'all' } : {}),
      })

      try {
        await deleteRecord('app-state', `folder-handle:${folderName}`)
      } catch (e) {
        console.warn('[Library Store] Could not delete folder handle:', e)
      }

      const songsToRemove = this.songs.filter(s => s.folderPath === folderName)
      if (this.previewSongId && songsToRemove.some(s => s.id === this.previewSongId)) {
        this.stopPreview()
      }

      const removeIds = new Set(songsToRemove.map(s => s.id))
      this.songs = this.songs.filter(s => !removeIds.has(s.id))

      if (this.selectedFolder === folderName) {
        this.selectedFolder = 'all'
      }

      if (this.selectedSongId && removeIds.has(this.selectedSongId)) {
        this.selectedSongId = this.sortedSongs[0]?.id ?? null
      }

      await persistQueue.run(async () => {
        for (const id of removeIds) {
          await deleteSongFromLibrary(id)
        }
        await saveLibrary(this.songs)
      })
    },
  },
})