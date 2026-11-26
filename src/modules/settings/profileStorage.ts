import type { HandSelection, PlayMode } from '../game/playSession'
import type { ModeScoreEntry, StoredModeSelection, UserProfile } from '../../types/profile'
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
    userBookmarksBySongId: {},
    modeSelectionsBySongId: {},
  }
}

const VALID_PLAY_MODES = new Set<PlayMode>(['listen', 'noteMemory', 'practice', 'performance'])
const VALID_HAND_SELECTIONS = new Set<HandSelection>(['left', 'right', 'both'])

export function normalizeModeSelection(entry: Partial<StoredModeSelection> | undefined): StoredModeSelection | undefined {
  if (!entry || !VALID_PLAY_MODES.has(entry.mode as PlayMode)) return undefined
  const mode = entry.mode as PlayMode
  const handSelection: HandSelection = mode === 'listen'
    ? 'both'
    : VALID_HAND_SELECTIONS.has(entry.handSelection as HandSelection)
      ? (entry.handSelection as HandSelection)
      : 'right'
  return {
    mode,
    handSelection,
    updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now(),
  }
}

function normalizeModeSelectionsBySongId(
  map: UserProfile['modeSelectionsBySongId'] | undefined,
): UserProfile['modeSelectionsBySongId'] {
  if (!map || typeof map !== 'object') return {}
  const normalized: UserProfile['modeSelectionsBySongId'] = {}
  for (const [songId, entry] of Object.entries(map)) {
    const valid = normalizeModeSelection(entry)
    if (valid) normalized[songId] = valid
  }
  return normalized
}

function normalizeUserBookmarksBySongId(
  map: UserProfile['userBookmarksBySongId'] | undefined,
): UserProfile['userBookmarksBySongId'] {
  if (!map || typeof map !== 'object') return {}
  const normalized: UserProfile['userBookmarksBySongId'] = {}
  for (const [songId, entry] of Object.entries(map)) {
    if (!entry || !Array.isArray(entry.bookmarks)) continue
    const bookmarks = entry.bookmarks
      .filter(bookmark =>
        bookmark
        && typeof bookmark.id === 'string'
        && typeof bookmark.timeUs === 'number'
        && Number.isFinite(bookmark.timeUs)
        && typeof bookmark.label === 'string',
      )
      .map(bookmark => ({ id: bookmark.id, timeUs: bookmark.timeUs, label: bookmark.label }))
      .sort((a, b) => a.timeUs - b.timeUs)
    if (bookmarks.length > 0) {
      normalized[songId] = {
        bookmarks,
        updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now(),
      }
    }
  }
  return normalized
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
    userBookmarksBySongId: normalizeUserBookmarksBySongId(profile.userBookmarksBySongId),
    lastModeSelection: normalizeModeSelection(profile.lastModeSelection),
    modeSelectionsBySongId: normalizeModeSelectionsBySongId(profile.modeSelectionsBySongId),
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
