import type { SongMetadata, SongSortKey, SortDirection } from '../../types/song'
import { STORAGE_KEYS } from '../settings/storageKeys'
import { getAll, put, get } from '../storage/indexedDb'

export async function loadLibrary(): Promise<SongMetadata[]> {
  try {
    type SongMeta = Omit<SongMetadata, 'data'>
    const metadata = await getAll<SongMeta>('songs-metadata')
    return metadata.map(meta => ({ ...meta, data: undefined }))
  } catch (error) {
    console.error('[Song Library] Lỗi khi load từ IndexedDB, fallback về localStorage:', error)
    const raw = localStorage.getItem(STORAGE_KEYS.library)
    return raw ? JSON.parse(raw) : []
  }
}
export async function saveLibrary(songs: SongMetadata[]): Promise<void> {
  try {
    for (const song of songs) {
      const { data, ...metadata } = song
      await put('songs-metadata', metadata)
      if (data) {
        await put('songs-data', { id: song.id, data })
      }
    }
  } catch (error) {
    console.error('[Song Library] Lỗi khi save:', error)
    throw error
  }
}

export async function loadSongData(songId: string): Promise<string | undefined> {
  try {
    const record = await get<{ id: string; data: string }>('songs-data', songId)
    return record?.data
  } catch (error) {
    console.error('[Song Library] Lỗi khi load song data:', error)
    return undefined
  }
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
