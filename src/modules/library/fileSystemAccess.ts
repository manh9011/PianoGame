export interface PickedMidiFolder {
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

export async function pickMidiFilesFromFolder(): Promise<PickedMidiFolder | null> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandleLike> }).showDirectoryPicker
  if (!picker) return null
  const handle = await picker()
  const files = await collectMidiFiles(handle)
  return { name: handle.name, files }
}

async function collectMidiFiles(directory: DirectoryHandleLike): Promise<File[]> {
  const files: File[] = []
  for await (const entry of directory.values()) {
    if (entry.kind === 'file' && isMidiFile(entry.name) && entry.getFile) files.push(await entry.getFile())
    if (entry.kind === 'directory' && entry.values) files.push(...await collectMidiFiles(entry as DirectoryHandleLike))
  }
  return files
}

function isMidiFile(name: string) {
  return /\.(mid|midi|rmi|rmid)$/i.test(name)
}
