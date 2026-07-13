export interface SongMetadata {
  id: string
  title: string
  duration: number
  trackCount: number
  noteCount: number
  bestScore: number
  playCount: number
  lastPlayed: number
  recent: boolean
  data?: string
  hash?: string
  rating?: number
  difficulty?: number
  folderPath?: string
}

export type SongSortKey = 'bestScore' | 'playCount' | 'lastPlayed' | 'title' | 'duration' | 'rating' | 'difficulty'
export type SortDirection = 'asc' | 'desc'
