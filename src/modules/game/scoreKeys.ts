import type { ModeScoreEntry, StoredTrackProperties } from '../../types/profile'
import type { HandSelection, PlayMode } from './playSession'
import { getSheetTrackSelectionKey, type TrackProperties } from './trackProperties'

export const LEGACY_TRACK_SELECTION_KEY = 'legacy'

type TrackSelectionSource = Array<Pick<TrackProperties | StoredTrackProperties, 'trackId' | 'role'>>

export interface ScoreBucketRef {
  mode: PlayMode
  handSelection: HandSelection
  trackSelectionKey?: string | null
}

export function normalizeTrackSelectionKey(trackSelectionKey?: string | null) {
  return trackSelectionKey?.trim() || LEGACY_TRACK_SELECTION_KEY
}

export function trackSelectionKeyForTracks(tracks?: TrackSelectionSource | null) {
  return normalizeTrackSelectionKey(tracks?.length ? getSheetTrackSelectionKey(tracks) : '')
}

export function scoreBucketKey(songId: string, entry: ScoreBucketRef) {
  return `${songId}:${entry.mode}:${entry.handSelection}:${normalizeTrackSelectionKey(entry.trackSelectionKey)}`
}

export function isSameScoreBucket(entry: ModeScoreEntry, songId: string, bucket: ScoreBucketRef) {
  return entry.songId === songId
    && entry.mode === bucket.mode
    && entry.handSelection === bucket.handSelection
    && normalizeTrackSelectionKey(entry.trackSelectionKey) === normalizeTrackSelectionKey(bucket.trackSelectionKey)
}

export function isBetterModeScore(next: ModeScoreEntry, previous?: ModeScoreEntry) {
  if (!previous) return next.score > 0
  if (next.mode === 'performance' && next.perfect !== previous.perfect) return next.perfect
  if (next.score !== previous.score) return next.score > previous.score
  if (next.accuracy !== previous.accuracy) return next.accuracy > previous.accuracy
  return next.playedAt > previous.playedAt
}
