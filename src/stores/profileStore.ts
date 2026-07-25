import { defineStore } from 'pinia'
import type { ModeScoreEntry, StoredFingeringAssignment, StoredTrackProperties, UserProfile } from '../types/profile'
import { achievementFromHistory } from '../modules/game/achievementScoring'
import { isBetterModeScore, isSameScoreBucket, LEGACY_TRACK_SELECTION_KEY, normalizeTrackSelectionKey, scoreBucketKey, trackSelectionKeyForTracks } from '../modules/game/scoreKeys'
import type { SongPlayStats } from '../modules/game/songStatistics'
import { createDefaultProfile, loadProfiles, saveProfiles, loadActiveProfileId, saveActiveProfileId, migrateLegacyScoresToTrackSelections } from '../modules/settings/profileStorage'
import { persistQueue } from '../modules/storage/indexedDb'

const SCORE_HISTORY_LIMIT = 300

function modeScoreEntryFromStats(songId: string, stats: SongPlayStats): ModeScoreEntry {
  return modeScoreEntryWithMode(songId, stats, stats.mode)
}

function modeScoreEntryWithMode(songId: string, stats: SongPlayStats, mode: ModeScoreEntry['mode']): ModeScoreEntry {
  const trackSelectionKey = normalizeTrackSelectionKey(stats.trackSelectionKey)
  return {
    songId,
    mode,
    handSelection: stats.handSelection,
    trackSelectionKey,
    score: stats.achievementBreakdown.total,
    gameplayPoints: stats.gameplayPoints,
    achievementBreakdown: stats.achievementBreakdown,
    grade: stats.grade,
    accuracy: stats.accuracy,
    perfect: stats.perfect,
    averageSpeed: stats.averageSpeed,
    rawPoints: stats.rawPoints,
    notesUserCouldHavePlayed: stats.notesUserCouldHavePlayed,
    notesUserActuallyPlayed: stats.notesUserActuallyPlayed,
    totalPlayableNotes: stats.totalPlayableNotes,
    strayNotes: stats.strayNotes,
    missedNotes: stats.missedNotes,
    wrongNotes: stats.wrongNotes,
    notesHit: stats.notesHit,
    errors: stats.errors,
    timeSpentUs: stats.timeSpentUs,
    playedAt: stats.playedAt,
    failed: stats.failed,
    failureReason: stats.failureReason,
  }
}

function modeScoreEntriesFromStats(songId: string, stats: SongPlayStats): ModeScoreEntry[] {
  const entry = modeScoreEntryFromStats(songId, stats)
  return stats.mode === 'performance'
    ? [entry, modeScoreEntryWithMode(songId, stats, 'practice')]
    : [entry]
}

function rebuildBestScoresBySongMode(scoresByMode: UserProfile['scoresByMode']) {
  const bestScoresBySongMode: UserProfile['bestScoresBySongMode'] = {}
  for (const entries of Object.values(scoresByMode)) {
    for (const entry of entries ?? []) {
      const sameBucketEntries = entries.filter(item => isSameScoreBucket(item, entry.songId, entry))
      const achievementBreakdown = achievementFromHistory(sameBucketEntries)
      const achievementEntry: ModeScoreEntry = achievementBreakdown
        ? { ...entry, score: achievementBreakdown.total, achievementBreakdown }
        : entry
      const key = scoreBucketKey(entry.songId, achievementEntry)
      if (isBetterModeScore(achievementEntry, bestScoresBySongMode[key])) {
        bestScoresBySongMode[key] = achievementEntry
      }
    }
  }
  return bestScoresBySongMode
}

export interface AchievementCelebration {
  songId: string
  mode: ModeScoreEntry['mode']
  handSelection: ModeScoreEntry['handSelection']
  trackSelectionKey?: string
  from: number
  to: number
  playedAt: number
}


export const useProfileStore = defineStore('profiles', {
  state: () => ({
    profiles: [createDefaultProfile()],
    activeProfileId: '',
    loading: false,
    initialized: false,
    lastAchievementCelebration: null as AchievementCelebration | null,
  }),
  getters: { activeProfile(state): UserProfile { return state.profiles.find(p => p.id === state.activeProfileId) || state.profiles[0] } },
  actions: {
    async hydrate() {
      if (this.initialized) return
      this.loading = true
      try {
        const profiles = await loadProfiles()
        const activeProfileId = await loadActiveProfileId()
        let migratedScores = false
        for (const profile of profiles) {
          migratedScores = migrateLegacyScoresToTrackSelections(profile) || migratedScores
        }
        if (migratedScores) {
          await saveProfiles(profiles)
        }
        Object.assign(this.$state, {
          profiles,
          activeProfileId: activeProfileId || profiles[0].id,
          initialized: true,
          loading: false,
        })
      } catch (error) {
        console.error('[Profile Store] Lỗi khi hydrate:', error)
        this.loading = false
      }
    },
    persist() {
      const profiles = JSON.parse(JSON.stringify(this.profiles))
      const activeId = this.activeProfile.id
      persistQueue.enqueue(async () => {
        await saveProfiles(profiles)
        await saveActiveProfileId(activeId)
      })
    },
    createProfile(name: string) { this.profiles.push(createDefaultProfile(name)); this.activeProfileId = this.profiles[this.profiles.length - 1].id; this.persist() },
    selectProfile(id: string) { this.activeProfileId = id; this.persist() },
    deleteProfile(id: string) { if (this.profiles.length <= 1) return; this.profiles = this.profiles.filter(p => p.id !== id); if (this.activeProfileId === id) this.activeProfileId = this.profiles[0].id; this.persist() },
    markRecent(songId: string) { const p = this.activeProfile; p.recentSongIds = [songId, ...p.recentSongIds.filter(id => id !== songId)].slice(0, 8); this.persist() },
    loopRegionFor(songId: string) {
      return this.activeProfile.loopRegionsBySongId?.[songId]
    },
    saveLoopRegion(songId: string, startUs: number, endUs: number) {
      const p = this.activeProfile
      p.loopRegionsBySongId ??= {}
      p.loopRegionsBySongId[songId] = { startUs, endUs, updatedAt: Date.now() }
      this.persist()
    },
    fingeringFor(songId: string) {
      return this.activeProfile.fingeringsBySongId?.[songId]
    },
    saveFingering(songId: string, assignments: StoredFingeringAssignment[], handSize?: string) {
      const p = this.activeProfile
      p.fingeringsBySongId ??= {}
      p.fingeringsBySongId[songId] = { assignments, handSize, updatedAt: Date.now() }
      this.persist()
    },
    trackSettingsFor(songId: string) {
      return this.activeProfile.trackSettingsBySongId?.[songId]
    },
    assignLegacyScoresToTrackSelection(songId: string, tracks: StoredTrackProperties[]) {
      const p = this.activeProfile
      const trackSelectionKey = trackSelectionKeyForTracks(tracks)
      let changed = false
      p.scoresByMode ??= {}
      for (const entries of Object.values(p.scoresByMode)) {
        for (const entry of entries ?? []) {
          if (entry.songId !== songId) continue
          if (normalizeTrackSelectionKey(entry.trackSelectionKey) !== LEGACY_TRACK_SELECTION_KEY) continue
          entry.trackSelectionKey = trackSelectionKey
          changed = true
        }
      }
      if (changed) {
        p.bestScoresBySongMode = rebuildBestScoresBySongMode(p.scoresByMode)
      }
      return changed
    },
    saveTrackSettings(songId: string, tracks: StoredTrackProperties[]) {
      const p = this.activeProfile
      const previousTrackSelectionKey = trackSelectionKeyForTracks(p.trackSettingsBySongId?.[songId]?.tracks)
      const nextTrackSelectionKey = trackSelectionKeyForTracks(tracks)
      this.assignLegacyScoresToTrackSelection(songId, p.trackSettingsBySongId?.[songId]?.tracks ?? tracks)
      p.trackSettingsBySongId ??= {}
      p.trackSettingsBySongId[songId] = { tracks, updatedAt: Date.now() }
      if (previousTrackSelectionKey !== nextTrackSelectionKey) {
        p.bestScoresBySongMode = rebuildBestScoresBySongMode(p.scoresByMode)
      }
      this.persist()
    },
    currentTrackSelectionKey(songId: string) {
      return trackSelectionKeyForTracks(this.trackSettingsFor(songId)?.tracks)
    },
    scoreEntriesFor(songId: string, mode: ModeScoreEntry['mode'], handSelection: ModeScoreEntry['handSelection'], trackSelectionKey?: string) {
      const exactTrackSelectionKey = normalizeTrackSelectionKey(trackSelectionKey ?? this.currentTrackSelectionKey(songId))
      const entries = this.activeProfile.scoresByMode[mode] ?? []
      return entries.filter(entry => isSameScoreBucket(entry, songId, { mode, handSelection, trackSelectionKey: exactTrackSelectionKey }))
    },
    recordScore(songId: string, stats: SongPlayStats) {
      this.recordScores(songId, [stats])
    },
    recordScores(songId: string, statsBatch: SongPlayStats[]) {
      const p = this.activeProfile
      p.recentSongIds = [songId, ...p.recentSongIds.filter(id => id !== songId)].slice(0, 8)
      p.bestScoresBySongMode ??= {}
      p.scoresByMode ??= {}
      const entries = statsBatch
        .filter(stats => stats.mode !== 'listen')
        .flatMap(stats => modeScoreEntriesFromStats(songId, stats))
      const primaryEntry = entries[0]

      for (const entry of entries) {
        const key = scoreBucketKey(songId, entry)
        const previousBest = p.bestScoresBySongMode[key]
        const list = p.scoresByMode[entry.mode] ?? []
        const nextList = [entry, ...list].slice(0, SCORE_HISTORY_LIMIT)
        p.scoresByMode[entry.mode] = nextList
        const achievementBreakdown = achievementFromHistory(nextList.filter(item => isSameScoreBucket(item, songId, entry)))
        const achievementEntry = achievementBreakdown
          ? { ...entry, score: achievementBreakdown.total, achievementBreakdown }
          : entry
        if (isBetterModeScore(achievementEntry, previousBest)) {
          p.bestScoresBySongMode[key] = achievementEntry
          const previousScore = previousBest?.score ?? 0
          if (achievementEntry.score > previousScore && (!primaryEntry || isSameScoreBucket(entry, songId, primaryEntry))) {
            this.lastAchievementCelebration = {
              songId,
              mode: achievementEntry.mode,
              handSelection: achievementEntry.handSelection,
              trackSelectionKey: achievementEntry.trackSelectionKey,
              from: previousScore,
              to: achievementEntry.score,
              playedAt: achievementEntry.playedAt,
            }
          }
        }
      }
      this.persist()
    },
    bestScoreFor(songId: string, mode: ModeScoreEntry['mode'], handSelection: ModeScoreEntry['handSelection'], trackSelectionKey?: string) {
      const exactTrackSelectionKey = normalizeTrackSelectionKey(trackSelectionKey ?? this.currentTrackSelectionKey(songId))
      return this.activeProfile.bestScoresBySongMode[scoreBucketKey(songId, { mode, handSelection, trackSelectionKey: exactTrackSelectionKey })]
    },
    consumeAchievementCelebration(songId: string, mode: ModeScoreEntry['mode'], handSelection: ModeScoreEntry['handSelection'], trackSelectionKey?: string) {
      const celebration = this.lastAchievementCelebration
      const expectedTrackSelectionKey = normalizeTrackSelectionKey(trackSelectionKey ?? this.currentTrackSelectionKey(songId))
      if (!celebration
        || celebration.songId !== songId
        || celebration.mode !== mode
        || celebration.handSelection !== handSelection
        || normalizeTrackSelectionKey(celebration.trackSelectionKey) !== expectedTrackSelectionKey
      ) return null
      this.lastAchievementCelebration = null
      return celebration
    },
  },
})
