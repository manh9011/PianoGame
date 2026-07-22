import { isSupportedSongFile } from './songImport'

export interface PickedSongFolder {
  name: string
  files: File[]
}

interface FileSystemEntryLike {
  kind: 'file' | 'directory'
  name: string
  getFile?: () => Promise<File>
  values?: () => AsyncIterable<FileSystemEntryLike>
}

interface DirectoryHandleLike extends FileSystemEntryLike {
  kind: 'directory'
  values: () => AsyncIterable<FileSystemEntryLike>
}

export function supportsFileSystemAccess() {
  return 'showDirectoryPicker' in window
}

export async function pickSongFilesFromFolder(): Promise<PickedSongFolder | null> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandleLike> }).showDirectoryPicker
  if (!picker) return null
  const handle = await picker()
  const files = await collectSongFiles(handle)
  return { name: handle.name, files }
}

export async function pickMidiFilesFromFolder(): Promise<PickedSongFolder | null> {
  return pickSongFilesFromFolder()
}

async function collectSongFiles(directory: DirectoryHandleLike): Promise<File[]> {
  const files: File[] = []
  for await (const entry of directory.values()) {
    if (entry.kind === 'file' && isSupportedSongFile(entry.name) && entry.getFile) files.push(await entry.getFile())
    if (entry.kind === 'directory' && entry.values) files.push(...await collectSongFiles(entry as DirectoryHandleLike))
  }
  return files
}
