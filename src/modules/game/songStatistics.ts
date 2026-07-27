import type { AchievementBreakdownScore } from '../../types/profile'
import { achievementMaxFor, achievementWeightsFor, calculateAchievementBreakdown } from './achievementScoring'
import { trackSelectionKeyForTracks } from './scoreKeys'
import { isPlayableNote } from './hitDetection'
import type { HandSelection, PlaySession } from './playSession'
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

function playableNotesFor(session: PlaySession, handSelection: HandSelection) {
  return session.notes.filter(note => isPlayableNote(note, session.tracks, handSelection, session))
}

function playableProgressRatio(score: ScoreState, session: PlaySession, handSelection: HandSelection) {
  const playableNotes = playableNotesFor(session, handSelection)
  if (!playableNotes.length) return 0
  const completedNotes = playableNotes.filter(note => score.noteOutcomes[note.id])
  return Math.max(0, Math.min(1, completedNotes.length / playableNotes.length))
}

function playedProgressRatio(score: ScoreState, session: PlaySession, handSelection: HandSelection) {
  const playableProgress = playableProgressRatio(score, session, handSelection)
  if (session.mode === 'noteMemory') return playableProgress

  const duration = session.loopState.durationUs || Math.max(...session.notes.map(note => note.end), 0)
  if (!duration) return playableProgress
  const coveredUs = score.playedSegments.reduce((sum, segment) => sum + Math.max(0, Math.min(duration, segment.endUs) - Math.max(0, segment.startUs)), 0)
  return Math.max(0, Math.min(1, coveredUs / duration))
}

export function summarizeStats(score: ScoreState, session: PlaySession, options: { handSelection?: HandSelection } = {}): SongPlayStats {
  const handSelection = options.handSelection ?? session.handSelection
  const scoringEnabled = session.modeConfig.scoringEnabled
  const progressRatio = playedProgressRatio(score, session, handSelection)
  const finishedEnough = progressRatio >= 0.995 && session.finished
  const totalPlayableNotes = playableNotesFor(session, handSelection).length
  const weights = achievementWeightsFor(handSelection)
  const displayedAverageSpeed = averageSpeed(score)
  const achievementScore = { ...score, totalPlayableNotes, averageSpeed: displayedAverageSpeed }
  const achievementBreakdown = scoringEnabled && finishedEnough ? calculateAchievementBreakdown(achievementScore, handSelection, session.failed) : {
    notes: 0,
    notesMax: weights.notes,
    hold: 0,
    holdMax: weights.hold,
    speed: 0,
    speedMax: weights.speed,
    total: 0,
    max: achievementMaxFor(handSelection),
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
    handSelection,
    trackSelectionKey: trackSelectionKeyForTracks(session.tracks),
    failed: session.failed,
    failureReason: session.failureReason,
    playedAt: Date.now(),
    ratingScore,
    ratingMax: achievementMaxFor(handSelection),
    progressRatio,
    notesHit: score.notesUserActuallyPlayed,
    totalPlayableNotes,
    errors: score.strayNotes + score.wrongNotes + score.missedNotes,
    timeSpentUs,
  }
}
