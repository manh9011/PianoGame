import type { UserProfile } from '../../types/profile'
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
  }
}

function normalizeProfile(profile: Partial<UserProfile>): UserProfile {
  return {
    id: profile.id || makeId(),
    name: profile.name || 'Người chơi',
    createdAt: profile.createdAt || Date.now(),
    recentSongIds: profile.recentSongIds ?? [],
    bestScoresBySongMode: profile.bestScoresBySongMode ?? {},
    scoresByMode: profile.scoresByMode ?? {},
    loopRegionsBySongId: profile.loopRegionsBySongId ?? {},
  }
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
