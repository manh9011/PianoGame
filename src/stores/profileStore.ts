import { defineStore } from 'pinia'
import type { ModeScoreEntry, UserProfile } from '../types/profile'
import { achievementFromHistory } from '../modules/game/achievementScoring'
import type { SongPlayStats } from '../modules/game/songStatistics'
import { createDefaultProfile, loadProfiles, saveProfiles, loadActiveProfileId, saveActiveProfileId } from '../modules/settings/profileStorage'
import { persistQueue } from '../modules/storage/indexedDb'

const SCORE_HISTORY_LIMIT = 50

export interface AchievementCelebration {
  songId: string
  mode: ModeScoreEntry['mode']
  handSelection: ModeScoreEntry['handSelection']
  from: number
  to: number
  playedAt: number
}

function scoreKey(songId: string, entry: Pick<ModeScoreEntry, 'mode' | 'handSelection'>) {
  return `${songId}:${entry.mode}:${entry.handSelection}`
}

function isBetterScore(next: ModeScoreEntry, previous?: ModeScoreEntry) {
  if (!previous) return next.score > 0
  if (next.mode === 'performance' && next.perfect !== previous.perfect) return next.perfect
  if (next.score !== previous.score) return next.score > previous.score
  if (next.accuracy !== previous.accuracy) return next.accuracy > previous.accuracy
  return next.playedAt > previous.playedAt
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
    recordScore(songId: string, stats: SongPlayStats) {
      this.markRecent(songId)
      if (stats.mode === 'listen') return
      const p = this.activeProfile
      p.bestScoresBySongMode ??= {}
      p.scoresByMode ??= {}
      const key = scoreKey(songId, stats)
      const previousBest = p.bestScoresBySongMode[key]
      const entry: ModeScoreEntry = {
        songId,
        mode: stats.mode,
        handSelection: stats.handSelection,
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
      const list = p.scoresByMode[entry.mode] ?? []
      const nextList = [entry, ...list].slice(0, SCORE_HISTORY_LIMIT)
      p.scoresByMode[entry.mode] = nextList
      const achievementBreakdown = achievementFromHistory(nextList.filter(item => item.songId === songId && item.handSelection === entry.handSelection))
      const achievementEntry = achievementBreakdown
        ? { ...entry, score: achievementBreakdown.total, achievementBreakdown }
        : entry
      if (isBetterScore(achievementEntry, previousBest)) {
        p.bestScoresBySongMode[key] = achievementEntry
        const previousScore = previousBest?.score ?? 0
        if (achievementEntry.score > previousScore) {
          this.lastAchievementCelebration = {
            songId,
            mode: achievementEntry.mode,
            handSelection: achievementEntry.handSelection,
            from: previousScore,
            to: achievementEntry.score,
            playedAt: achievementEntry.playedAt,
          }
        }
      }
      this.persist()
    },
    bestScoreFor(songId: string, mode: ModeScoreEntry['mode'], handSelection: ModeScoreEntry['handSelection']) {
      return this.activeProfile.bestScoresBySongMode[`${songId}:${mode}:${handSelection}`]
    },
    consumeAchievementCelebration(songId: string, mode: ModeScoreEntry['mode'], handSelection: ModeScoreEntry['handSelection']) {
      const celebration = this.lastAchievementCelebration
      if (!celebration || celebration.songId !== songId || celebration.mode !== mode || celebration.handSelection !== handSelection) return null
      this.lastAchievementCelebration = null
      return celebration
    },
  },
})
