import type { AchievementBreakdownScore, ModeScoreEntry } from '../../types/profile'
import type { HandSelection } from './playSession'
import { DEFAULT_SCORING_CONFIG } from './scoring'

export function achievementMaxFor(handSelection: HandSelection) {
  return handSelection === 'both' ? 15 : 10
}

export function achievementWeightsFor(handSelection: HandSelection) {
  return handSelection === 'both'
    ? { notes: 6, hold: 3, speed: 6 }
    : { notes: 4, hold: 2, speed: 4 }
}

export function roundAchievementScore(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

export function calculateAchievementBreakdown(score: {
  rawPoints: number
  notesUserCouldHavePlayed: number
  notesUserActuallyPlayed: number
  totalPlayableNotes?: number
  strayNotes: number
  missedNotes: number
  wrongNotes: number
}, handSelection: HandSelection, failed = false): AchievementBreakdownScore {
  const weights = achievementWeightsFor(handSelection)
  const max = achievementMaxFor(handSelection)
  const possibleNotes = Math.max(score.notesUserCouldHavePlayed, score.notesUserActuallyPlayed)
  const totalNotes = score.totalPlayableNotes && score.totalPlayableNotes > 0 ? score.totalPlayableNotes : possibleNotes
  const mistakes = score.strayNotes + score.wrongNotes + score.missedNotes + (failed ? 1 : 0)
  const notesRatio = totalNotes > 0 ? Math.max(0, Math.min(1, (score.notesUserActuallyPlayed - mistakes) / totalNotes)) : 0
  const perfectHoldPoints = score.notesUserActuallyPlayed * DEFAULT_SCORING_CONFIG.pointScale
  const holdRatio = perfectHoldPoints > 0 ? Math.min(1, score.rawPoints / perfectHoldPoints) : 0
  const totalErrors = score.strayNotes + score.wrongNotes + score.missedNotes
  const baseSpeedRatio = possibleNotes > 0 ? (score.rawPoints / Math.max(1, possibleNotes * DEFAULT_SCORING_CONFIG.pointScale)) : 0
  const speedRatio = Math.max(0, Math.min(1, baseSpeedRatio * Math.max(0.25, 1 - totalErrors * 0.03)))
  const notes = roundAchievementScore(weights.notes * notesRatio)
  const hold = roundAchievementScore(weights.hold * holdRatio)
  const speed = roundAchievementScore(weights.speed * speedRatio)
  const total = Math.min(max, roundAchievementScore(notes + hold + speed))

  return {
    notes,
    notesMax: weights.notes,
    hold,
    holdMax: weights.hold,
    speed,
    speedMax: weights.speed,
    total,
    max,
  }
}

export function entryAchievementBreakdown(entry: ModeScoreEntry): AchievementBreakdownScore {
  if (entry.achievementBreakdown) return entry.achievementBreakdown
  const score = {
    rawPoints: entry.rawPoints ?? entry.gameplayPoints ?? 0,
    notesUserCouldHavePlayed: entry.notesUserCouldHavePlayed ?? entry.notesHit ?? 0,
    notesUserActuallyPlayed: entry.notesUserActuallyPlayed ?? entry.notesHit ?? 0,
    totalPlayableNotes: entry.totalPlayableNotes,
    strayNotes: entry.strayNotes ?? 0,
    missedNotes: entry.missedNotes ?? entry.errors ?? 0,
    wrongNotes: entry.wrongNotes ?? 0,
  }
  return calculateAchievementBreakdown(score, entry.handSelection, entry.failed)
}

export function entryAchievementTotal(entry: ModeScoreEntry) {
  return entryAchievementBreakdown(entry).total
}

export function topAchievementAttempts(entries: ModeScoreEntry[]) {
  return entries
    .slice()
    .sort((a, b) => entryAchievementTotal(b) - entryAchievementTotal(a) || b.accuracy - a.accuracy || b.averageSpeed - a.averageSpeed || b.playedAt - a.playedAt)
    .slice(0, 3)
}

export function averageAchievementBreakdown(entries: ModeScoreEntry[]) {
  const top = topAchievementAttempts(entries)
  if (!top.length) return undefined

  const first = entryAchievementBreakdown(top[0])
  const count = top.length
  const notes = roundAchievementScore(top.reduce((sum, entry) => sum + entryAchievementBreakdown(entry).notes, 0) / count)
  const hold = roundAchievementScore(top.reduce((sum, entry) => sum + entryAchievementBreakdown(entry).hold, 0) / count)
  const speed = roundAchievementScore(top.reduce((sum, entry) => sum + entryAchievementBreakdown(entry).speed, 0) / count)
  const total = Math.min(first.max, roundAchievementScore(notes + hold + speed))

  return {
    notes,
    notesMax: first.notesMax,
    hold,
    holdMax: first.holdMax,
    speed,
    speedMax: first.speedMax,
    total,
    max: first.max,
  }
}

export function scaleAchievementBreakdown(breakdown: AchievementBreakdownScore, total: number): AchievementBreakdownScore {
  if (!breakdown.total || total >= breakdown.total) return { ...breakdown, total }
  const scale = total / breakdown.total
  const notes = roundAchievementScore(breakdown.notes * scale)
  const hold = roundAchievementScore(breakdown.hold * scale)
  const speed = roundAchievementScore(Math.max(0, total - notes - hold))
  return { ...breakdown, notes, hold, speed, total }
}

export function aggregateAchievementBreakdown(entries: ModeScoreEntry[], previousScore = 0) {
  const raw = averageAchievementBreakdown(entries)
  if (!raw) return undefined
  const total = raw.total <= previousScore ? previousScore : Math.min(raw.max, previousScore + 3, raw.total)
  return scaleAchievementBreakdown(raw, total)
}

export function achievementFromHistory(entries: ModeScoreEntry[]) {
  const chronological = entries.slice().sort((a, b) => a.playedAt - b.playedAt)
  let current = 0
  let finalRaw: AchievementBreakdownScore | undefined

  for (let index = 0; index < chronological.length; index++) {
    const raw = averageAchievementBreakdown(chronological.slice(0, index + 1))
    if (!raw) continue
    finalRaw = raw
    if (raw.total > current) current = Math.min(raw.max, current + 3, raw.total)
  }

  return finalRaw ? scaleAchievementBreakdown(finalRaw, current) : undefined
}
