import type { FailureReason, HandSelection, PlayMode } from '../modules/game/playSession'

export interface AchievementBreakdownScore {
  notes: number
  notesMax: number
  hold: number
  holdMax: number
  speed: number
  speedMax: number
  total: number
  max: number
}

export interface ModeScoreEntry {
  songId: string
  mode: PlayMode
  handSelection: HandSelection
  score: number
  gameplayPoints?: number
  achievementBreakdown?: AchievementBreakdownScore
  grade: string
  accuracy: number
  perfect: boolean
  averageSpeed: number
  rawPoints?: number
  notesUserCouldHavePlayed?: number
  notesUserActuallyPlayed?: number
  strayNotes?: number
  missedNotes?: number
  wrongNotes?: number
  notesHit?: number
  errors?: number
  timeSpentUs?: number
  playedAt: number
  failed: boolean
  failureReason?: FailureReason
}

export interface StoredLoopRegion {
  startUs: number
  endUs: number
  updatedAt: number
}

export interface StoredFingeringAssignment {
  noteId: string
  hand: 'left' | 'right'
  finger: number
  source: 'manual' | 'auto'
  cost?: number
}

export interface StoredSongFingering {
  assignments: StoredFingeringAssignment[]
  handSize?: string
  updatedAt: number
}

export interface UserProfile {
  id: string
  name: string
  createdAt: number
  recentSongIds: string[]
  bestScoresBySongMode: Record<string, ModeScoreEntry>
  scoresByMode: Partial<Record<PlayMode, ModeScoreEntry[]>>
  loopRegionsBySongId: Record<string, StoredLoopRegion>
  fingeringsBySongId: Record<string, StoredSongFingering>
}
