import { isSupportedSongFile } from './songImport'
import { get, put } from '../storage/indexedDb'

export interface PickedSongFolder {
  name: string
  files: File[]
}

interface FileSystemEntryLike {
  kind: 'file' | 'directory'
  name: string
  getFile?: () => Promise<File>
  values?: () => AsyncIterable<FileSystemEntryLike>
  queryPermission?: (descriptor?: { mode: string }) => Promise<string>
  requestPermission?: (descriptor?: { mode: string }) => Promise<string>
}

interface DirectoryHandleLike extends FileSystemEntryLike {
  kind: 'directory'
  values: () => AsyncIterable<FileSystemEntryLike>
}

export function supportsFileSystemAccess() {
  return 'showDirectoryPicker' in window
}

export async function saveFolderHandle(folderName: string, handle: any): Promise<void> {
  try {
    if (!folderName) return
    await put('app-state', { key: `folder-handle:${folderName}`, handle })
  } catch (e) {
    console.warn('[FS Access] Cannot save directory handle in IndexedDB:', e)
  }
}

export async function getFolderHandle(folderName: string): Promise<DirectoryHandleLike | null> {
  try {
    const record = await get<{ key: string; handle: DirectoryHandleLike }>('app-state', `folder-handle:${folderName}`)
    return record?.handle ?? null
  } catch (e) {
    console.warn('[FS Access] Cannot get directory handle from IndexedDB:', e)
    return null
  }
}

export async function pickSongFilesFromFolder(targetFolderName?: string): Promise<PickedSongFolder | null> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandleLike> }).showDirectoryPicker
  if (!picker) return null
  const handle = await picker()
  const folderName = targetFolderName || handle.name
  await saveFolderHandle(handle.name, handle)
  if (targetFolderName && targetFolderName !== handle.name) {
    await saveFolderHandle(targetFolderName, handle)
  }
  const files = await collectSongFiles(handle)
  return { name: folderName, files }
}

export async function rescanSongFilesFromFolder(folderName: string, allowPickerFallback = true): Promise<PickedSongFolder | null> {
  const handle = await getFolderHandle(folderName)
  if (handle) {
    try {
      if (handle.queryPermission) {
        let state = await handle.queryPermission({ mode: 'read' })
        if (state !== 'granted' && allowPickerFallback && handle.requestPermission) {
          state = await handle.requestPermission({ mode: 'read' })
        }
        if (state === 'granted') {
          const files = await collectSongFiles(handle)
          return { name: folderName, files }
        }
      } else {
        const files = await collectSongFiles(handle)
        return { name: folderName, files }
      }
    } catch (e) {
      console.warn('[FS Access] Silent rescan with handle failed:', e)
    }
  }

  if (!allowPickerFallback) {
    return null
  }

  // Fallback to picker ONCE to establish handle for future silent rescans
  return pickSongFilesFromFolder(folderName)
}

export async function pickMidiFilesFromFolder(): Promise<PickedSongFolder | null> {
  return pickSongFilesFromFolder()
}

async function collectSongFiles(directory: DirectoryHandleLike): Promise<File[]> {
  const files: File[] = []
  let count = 0
  for await (const entry of directory.values()) {
    if (entry.kind === 'file' && isSupportedSongFile(entry.name) && entry.getFile) {
      files.push(await entry.getFile())
      count++
      if (count % 25 === 0) {
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    }
    if (entry.kind === 'directory' && entry.values) {
      files.push(...await collectSongFiles(entry as DirectoryHandleLike))
    }
  }
  return files
}
