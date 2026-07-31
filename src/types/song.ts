export type SongSourceType = 'midi' | 'musicxml' | 'hybrid'

export interface SongMetadata {
  id: string
  title: string
  duration: number
  trackCount: number
  noteCount: number
  bestScore: number
  playCount: number
  lastPlayed: number
  importedAt: number
  recent: boolean
  data?: string
  midiData?: string
  musicXmlData?: string
  compressedMusicXmlData?: string
  hash?: string
  playbackHash?: string
  notationHash?: string
  sourceType?: SongSourceType
  hasMidiSource?: boolean
  hasMusicXmlSource?: boolean
  originalFileName?: string
  rating?: number
  difficulty?: number
  folderPath?: string
}

export type SongSortKey = 'bestScore' | 'playCount' | 'lastPlayed' | 'importedAt' | 'title' | 'duration' | 'rating' | 'difficulty' | 'source'
export type SortDirection = 'asc' | 'desc'
