export interface ScoreLibraryItem {
  user_id: string
  score_id: string
  title: string
  author: string
  composer: string
  image: string
  views: number
  downloads: number
  created_date: string
  updated_date: string
}

export interface ScorePagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface ScoreListResponse {
  data: ScoreLibraryItem[]
  pagination: ScorePagination
}

export interface AuthorItem {
  name: string
  total_scores: number
  total_views: number
  total_downloads: number
}

export interface ComposerItem {
  name: string
  total_scores: number
  total_views: number
  total_downloads: number
}

export interface ImportJob {
  id: string
  url: string
  user_id: string | null
  score_id: string | null
  status: string
  error: string | null
  created_at: string
  updated_at: string
}

export interface ImportJobListResponse {
  imports: ImportJob[]
}

export type SortOption = 'views' | 'downloads' | 'created_date' | 'updated_date'

export type SearchMode = 'fulltext' | 'contains'

export interface ScoreLibraryState {
  scores: ScoreLibraryItem[]
  pagination: ScorePagination
  searchQuery: string
  searchMode: SearchMode
  selectedAuthor: string | null
  selectedComposer: string | null
  sort: SortOption
  page: number
  loading: boolean
  error: string | null
}
