const BASE_URL = 'https://scorelibrary.manh9011.qzz.io'

import type {
  ScoreListResponse,
  ScoreLibraryItem,
  AuthorItem,
  ComposerItem,
  ImportJob,
  ImportJobListResponse,
} from '../../types/scoreLibrary'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return res.json() as Promise<T>
  }
  return undefined as unknown as T
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function listScores(params: {
  page?: number
  limit?: number
  q?: string
  mode?: string
  field?: string
  sort?: string
  order?: string
}): Promise<ScoreListResponse> {
  const searchParams = new URLSearchParams()
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.limit != null) searchParams.set('limit', String(params.limit))
  if (params.q) {
    searchParams.set('q', params.q)
    if (params.mode) searchParams.set('mode', params.mode)
    if (params.field) searchParams.set('field', params.field)
  }
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.order) searchParams.set('order', params.order)

  const qs = searchParams.toString()
  return request<ScoreListResponse>(`/api/scores${qs ? `?${qs}` : ''}`)
}

export function getScore(userId: string, scoreId: string): Promise<ScoreLibraryItem> {
  return request<ScoreLibraryItem>(`/api/scores/${encodeURIComponent(userId)}/${encodeURIComponent(scoreId)}`)
}

export async function fetchMidiBlob(userId: string, scoreId: string): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/api/scores/${encodeURIComponent(userId)}/${encodeURIComponent(scoreId)}/midi`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }
  return res.blob()
}

export function listAuthors(): Promise<{ data: AuthorItem[] }> {
  return request<{ data: AuthorItem[] }>('/api/authors')
}

export function listComposers(): Promise<{ data: ComposerItem[] }> {
  return request<{ data: ComposerItem[] }>('/api/composers')
}

export function importScore(url: string): Promise<{ accepted: boolean; jobId: string }> {
  return request<{ accepted: boolean; jobId: string }>('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export function getImportJobs(ids: string[]): Promise<ImportJobListResponse> {
  return request<ImportJobListResponse>('/api/imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}
