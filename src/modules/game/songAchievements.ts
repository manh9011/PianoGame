import type { ModeScoreEntry, UserProfile } from '../../types/profile'
import { achievementFromHistory } from './achievementScoring'

export const MAX_LIBRARY_ACHIEVEMENT = 105

export function computeSongAchievementScores(scoresByMode: UserProfile['scoresByMode']): Record<string, number> {
  const scores: Record<string, number> = {}
  const bestBySongModeHand: Record<string, number> = {}
  const bySongModeHandTrack: Record<string, ModeScoreEntry[]> = {}

  for (const entries of Object.values(scoresByMode)) {
    for (const entry of entries ?? []) {
      const key = `${entry.songId}:${entry.mode}:${entry.handSelection}:${entry.trackSelectionKey ?? 'legacy'}`
      bySongModeHandTrack[key] ??= []
      bySongModeHandTrack[key]!.push(entry)
    }
  }

  for (const entries of Object.values(bySongModeHandTrack)) {
    const achievement = achievementFromHistory(entries ?? [])
    const firstEntry = entries?.[0]
    if (!achievement || !firstEntry) continue
    const key = `${firstEntry.songId}:${firstEntry.mode}:${firstEntry.handSelection}`
    bestBySongModeHand[key] = Math.max(bestBySongModeHand[key] ?? 0, achievement.total)
  }

  for (const [key, score] of Object.entries(bestBySongModeHand)) {
    const [songId] = key.split(':')
    scores[songId] = Math.min(MAX_LIBRARY_ACHIEVEMENT, (scores[songId] ?? 0) + score)
  }

  return scores
}
