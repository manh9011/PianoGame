import type { SongMetadata, SongSortKey, SortDirection } from '../../types/song'
import { STORAGE_KEYS } from '../settings/storageKeys'
import { getAll, put, get, deleteRecord, type SongDataRecord } from '../storage/indexedDb'

export interface SongPayload {
  midiData?: string
  musicXmlData?: string
  compressedMusicXmlData?: string
}

type SongMeta = Omit<SongMetadata, 'data' | 'midiData' | 'musicXmlData' | 'compressedMusicXmlData'>

function normalizePayload(record?: SongDataRecord): SongPayload {
  return {
    midiData: record?.midiData ?? record?.data,
    musicXmlData: record?.musicXmlData,
    compressedMusicXmlData: record?.compressedMusicXmlData,
  }
}

function normalizeMetadata(meta: SongMeta, payload?: SongPayload): SongMetadata {
  const midiData = payload?.midiData
  const musicXmlData = payload?.musicXmlData
  const compressedMusicXmlData = payload?.compressedMusicXmlData
  const hasMidiSource = meta.hasMidiSource ?? !!midiData
  const hasMusicXmlSource = meta.hasMusicXmlSource ?? (!!musicXmlData || !!compressedMusicXmlData)
  const sourceType = meta.sourceType ?? (hasMidiSource && hasMusicXmlSource ? 'hybrid' : hasMusicXmlSource ? 'musicxml' : 'midi')
  return {
    ...meta,
    data: undefined,
    midiData: undefined,
    musicXmlData: undefined,
    compressedMusicXmlData: undefined,
    playbackHash: meta.playbackHash ?? meta.hash,
    importedAt: meta.importedAt ?? 0,
    sourceType,
    hasMidiSource,
    hasMusicXmlSource,
  }
}

export async function loadLibrary(): Promise<SongMetadata[]> {
  try {
    const metadata = await getAll<SongMeta>('songs-metadata')
    return Promise.all(metadata.map(async meta => normalizeMetadata(meta, await loadSongPayload(meta.id))))
  } catch (error) {
    console.error('[Song Library] Lỗi khi load từ IndexedDB, fallback về localStorage:', error)
    const raw = localStorage.getItem(STORAGE_KEYS.library)
    if (!raw) return []
    const songs = JSON.parse(raw) as SongMetadata[]
    return songs.map(song => normalizeMetadata(song as SongMeta, { midiData: song.midiData ?? song.data, musicXmlData: song.musicXmlData, compressedMusicXmlData: song.compressedMusicXmlData }))
  }
}

export async function saveLibrary(songs: SongMetadata[]): Promise<void> {
  try {
    const existing = await getAll<SongMeta>('songs-metadata')
    const songIds = new Set(songs.map(song => song.id))
    const deletedIds = existing.map(song => song.id).filter(id => !songIds.has(id))

    for (const id of deletedIds) {
      await deleteSongFromLibrary(id)
    }

    for (const song of songs) {
      const { data, midiData, musicXmlData, compressedMusicXmlData, ...metadata } = song
      await put('songs-metadata', metadata)
      const payload: SongDataRecord = {
        id: song.id,
        midiData: midiData ?? data,
        musicXmlData,
        compressedMusicXmlData,
      }
      if (payload.midiData || payload.musicXmlData || payload.compressedMusicXmlData) await put('songs-data', payload)
    }
  } catch (error) {
    console.error('[Song Library] Lỗi khi save:', error)
    throw error
  }
}

export async function deleteSongFromLibrary(songId: string): Promise<void> {
  await deleteRecord('songs-metadata', songId)
  await deleteRecord('songs-data', songId)
}

export async function loadSongPayload(songId: string): Promise<SongPayload> {
  try {
    const record = await get<SongDataRecord>('songs-data', songId)
    return normalizePayload(record)
  } catch (error) {
    console.error('[Song Library] Lỗi khi load song payload:', error)
    return {}
  }
}

export async function loadSongMidiData(songId: string): Promise<string | undefined> {
  return (await loadSongPayload(songId)).midiData
}

export async function loadSongMusicXmlData(songId: string): Promise<string | undefined> {
  return (await loadSongPayload(songId)).musicXmlData
}

export async function loadSongCompressedMusicXmlData(songId: string): Promise<string | undefined> {
  return (await loadSongPayload(songId)).compressedMusicXmlData
}

export async function loadSongData(songId: string): Promise<string | undefined> {
  return loadSongMidiData(songId)
}

export function sortSongs(songs: SongMetadata[], key: SongSortKey, direction: SortDirection) {
  return [...songs].sort((a, b) => {
    const result = key === 'title'
      ? a.title.localeCompare(b.title)
      : Number(a[key] ?? 0) - Number(b[key] ?? 0)
    const directed = direction === 'asc' ? result : -result
    return directed || a.title.localeCompare(b.title)
  })
}

export function bufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToBuffer(data: string) {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function textToBase64(text: string) {
  return bufferToBase64(new TextEncoder().encode(text).buffer)
}

export function base64ToText(data: string) {
  return new TextDecoder().decode(base64ToBuffer(data))
}
