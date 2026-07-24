import type { ModeScoreEntry, UserProfile } from '../../types/profile'
import { achievementFromHistory } from '../game/achievementScoring'
import { isBetterModeScore, LEGACY_TRACK_SELECTION_KEY, normalizeTrackSelectionKey, scoreBucketKey, trackSelectionKeyForTracks } from '../game/scoreKeys'
import { get, getAll, put } from '../storage/indexedDb'
import { STORAGE_KEYS } from './storageKeys'

const makeId = () => crypto.randomUUID?.() ?? String(Date.now())

export function createDefaultProfile(name = 'Người chơi'): UserProfile {
  return {
    id: makeId(),
    name,
    createdAt: Date.now(),
    recentSongIds: [],
    bestScoresBySongMode: {},
    scoresByMode: {},
    loopRegionsBySongId: {},
    fingeringsBySongId: {},
    trackSettingsBySongId: {},
  }
}

function normalizeScoresByMode(scoresByMode: Partial<UserProfile['scoresByMode']>, trackSettingsBySongId: UserProfile['trackSettingsBySongId']) {
  const normalized: UserProfile['scoresByMode'] = {}
  for (const [mode, entries] of Object.entries(scoresByMode)) {
    normalized[mode as keyof UserProfile['scoresByMode']] = (entries ?? []).map(entry => ({
      ...entry,
      trackSelectionKey: normalizeTrackSelectionKey(entry.trackSelectionKey ?? trackSelectionKeyForTracks(trackSettingsBySongId[entry.songId]?.tracks)),
    }))
  }
  return normalized
}

function rebuildBestScoresBySongMode(scoresByMode: UserProfile['scoresByMode']) {
  const bestScoresBySongMode: UserProfile['bestScoresBySongMode'] = {}
  for (const entries of Object.values(scoresByMode)) {
    for (const entry of entries ?? []) {
      const sameBucketEntries = entries.filter(item =>
        item.songId === entry.songId
        && item.handSelection === entry.handSelection
        && normalizeTrackSelectionKey(item.trackSelectionKey) === normalizeTrackSelectionKey(entry.trackSelectionKey),
      )
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

function normalizeProfile(profile: Partial<UserProfile>): UserProfile {
  const trackSettingsBySongId = profile.trackSettingsBySongId ?? {}
  const scoresByMode = normalizeScoresByMode(profile.scoresByMode ?? {}, trackSettingsBySongId)
  return {
    id: profile.id || makeId(),
    name: profile.name || 'Người chơi',
    createdAt: profile.createdAt || Date.now(),
    recentSongIds: profile.recentSongIds ?? [],
    bestScoresBySongMode: rebuildBestScoresBySongMode(scoresByMode),
    scoresByMode,
    loopRegionsBySongId: profile.loopRegionsBySongId ?? {},
    fingeringsBySongId: profile.fingeringsBySongId ?? {},
    trackSettingsBySongId,
  }
}

export function migrateLegacyScoresToTrackSelections(profile: UserProfile): boolean {
  let changed = false
  for (const entries of Object.values(profile.scoresByMode)) {
    for (const entry of entries ?? []) {
      if (normalizeTrackSelectionKey(entry.trackSelectionKey) !== LEGACY_TRACK_SELECTION_KEY) continue
      const trackSelectionKey = trackSelectionKeyForTracks(profile.trackSettingsBySongId[entry.songId]?.tracks)
      if (trackSelectionKey === LEGACY_TRACK_SELECTION_KEY) continue
      entry.trackSelectionKey = trackSelectionKey
      changed = true
    }
  }
  if (changed) {
    profile.bestScoresBySongMode = rebuildBestScoresBySongMode(profile.scoresByMode)
  }
  return changed
}

export async function loadProfiles(): Promise<UserProfile[]> {
  try {
    const profiles = await getAll<UserProfile>('profiles')
    return profiles.length ? profiles.map(normalizeProfile) : [createDefaultProfile()]
  } catch (error) {
    console.error('[Profile Storage] Lỗi khi load profiles từ IndexedDB, fallback về localStorage:', error)
    const raw = localStorage.getItem(STORAGE_KEYS.profiles)
    const profiles = raw ? (JSON.parse(raw) as Partial<UserProfile>[]) : []
    return profiles.length ? profiles.map(normalizeProfile) : [createDefaultProfile()]
  }
}

export async function saveProfiles(profiles: UserProfile[]): Promise<void> {
  try {
    for (const profile of profiles) {
      await put('profiles', profile)
    }
  } catch (error) {
    console.error('[Profile Storage] Lỗi khi save profiles:', error)
    throw error
  }
}

export async function loadActiveProfileId(): Promise<string> {
  try {
    const record = await get<{ key: string; value: string }>('app-state', 'activeProfile')
    return record?.value ?? ''
  } catch (error) {
    console.error('[Profile Storage] Lỗi khi load activeProfileId, fallback về localStorage:', error)
    return localStorage.getItem(STORAGE_KEYS.activeProfile) || ''
  }
}

export async function saveActiveProfileId(id: string): Promise<void> {
  try {
    await put('app-state', { key: 'activeProfile', value: id })
  } catch (error) {
    console.error('[Profile Storage] Lỗi khi save activeProfileId:', error)
    throw error
  }
}
