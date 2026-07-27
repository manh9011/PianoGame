import { deleteRecord, get, put } from './indexedDb'

const RENDER_ASSET_STORE = 'render-assets'

export interface RenderAssetRecord {
  id: string
  name: string
  type: string
  blob: Blob
  createdAt: number
}

function createRenderAssetId() {
  return `render-asset:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

export async function saveRenderAsset(file: Blob, name: string) {
  const id = createRenderAssetId()
  const record: RenderAssetRecord = {
    id,
    name,
    type: file.type || 'application/octet-stream',
    blob: file,
    createdAt: Date.now(),
  }
  await put(RENDER_ASSET_STORE, record)
  return record
}

export async function loadRenderAsset(id: string) {
  if (!id) return null
  return await get<RenderAssetRecord>(RENDER_ASSET_STORE, id) ?? null
}

export async function loadRenderAssetBlob(id: string) {
  return (await loadRenderAsset(id))?.blob ?? null
}

export async function removeRenderAsset(id: string) {
  if (!id) return
  await deleteRecord(RENDER_ASSET_STORE, id)
}
