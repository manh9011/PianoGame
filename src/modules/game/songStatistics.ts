import type { AchievementBreakdownScore } from '../../types/profile'
import { achievementMaxFor, achievementWeightsFor, calculateAchievementBreakdown } from './achievementScoring'
import { trackSelectionKeyForTracks } from './scoreKeys'
import { isPlayableNote } from './hitDetection'
import type { PlaySession } from './playSession'
import type { ScoreState } from './scoring'
import { accuracy, averageSpeed, displayPoints, grade, isPerfect } from './scoring'

export interface SongPlayStats extends ScoreState {
  averageSpeed: number
  grade: string
  accuracy: number
  perfect: boolean
  mode: PlaySession['mode']
  handSelection: PlaySession['handSelection']
  trackSelectionKey: string
  failed: boolean
  failureReason?: PlaySession['failureReason']
  playedAt: number
  gameplayPoints: number
  achievementBreakdown: AchievementBreakdownScore
  ratingScore: number
  ratingMax: number
  progressRatio: number
  notesHit: number
  totalPlayableNotes: number
  errors: number
  timeSpentUs: number
}

function playableNotesFor(session: PlaySession) {
  return session.notes.filter(note => isPlayableNote(note, session.tracks, session.handSelection, session))
}

function playableProgressRatio(session: PlaySession) {
  const playableNotes = playableNotesFor(session)
  if (!playableNotes.length) return 0
  const completedNotes = playableNotes.filter(note => session.score.noteOutcomes[note.id])
  return Math.max(0, Math.min(1, completedNotes.length / playableNotes.length))
}

function playedProgressRatio(session: PlaySession) {
  const playableProgress = playableProgressRatio(session)
  if (session.mode === 'noteMemory') return playableProgress

  const duration = session.loopState.durationUs || Math.max(...session.notes.map(note => note.end), 0)
  if (!duration) return playableProgress
  const coveredUs = session.score.playedSegments.reduce((sum, segment) => sum + Math.max(0, Math.min(duration, segment.endUs) - Math.max(0, segment.startUs)), 0)
  return Math.max(0, Math.min(1, coveredUs / duration))
}

export function summarizeStats(score: ScoreState, session: PlaySession): SongPlayStats {
  const scoringEnabled = session.modeConfig.scoringEnabled
  const progressRatio = playedProgressRatio(session)
  const finishedEnough = progressRatio >= 0.995 && session.finished
  const totalPlayableNotes = playableNotesFor(session).length
  const weights = achievementWeightsFor(session.handSelection)
  const displayedAverageSpeed = averageSpeed(score)
  const achievementScore = { ...score, totalPlayableNotes, averageSpeed: displayedAverageSpeed }
  const achievementBreakdown = scoringEnabled && finishedEnough ? calculateAchievementBreakdown(achievementScore, session.handSelection, session.failed) : {
    notes: 0,
    notesMax: weights.notes,
    hold: 0,
    holdMax: weights.hold,
    speed: 0,
    speedMax: weights.speed,
    total: 0,
    max: achievementMaxFor(session.handSelection),
  }
  const ratingScore = achievementBreakdown.total
  const timeSpentUs = Math.round(score.speedTracking.playedRealUs)
  return {
    ...score,
    score: ratingScore,
    gameplayPoints: displayPoints(score.rawPoints),
    achievementBreakdown,
    averageSpeed: displayedAverageSpeed,
    grade: scoringEnabled ? grade(score) : 'N/A',
    accuracy: accuracy(score),
    perfect: scoringEnabled ? isPerfect(score) && !session.failed : false,
    mode: session.mode,
    handSelection: session.handSelection,
    trackSelectionKey: trackSelectionKeyForTracks(session.tracks),
    failed: session.failed,
    failureReason: session.failureReason,
    playedAt: Date.now(),
    ratingScore,
    ratingMax: achievementMaxFor(session.handSelection),
    progressRatio,
    notesHit: score.notesUserActuallyPlayed,
    totalPlayableNotes,
    errors: Math.max(score.strayNotes, score.missedNotes),
    timeSpentUs,
  }
}
