<script setup lang="ts">
import { supportsFileSystemAccess, pickMidiFilesFromFolder } from '../../modules/library/fileSystemAccess'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useToastStore } from '../../stores/toastStore'

const settings = useSettingsStore()
const library = useLibraryStore()
const toastStore = useToastStore()

async function pick() {
  const picked = await pickMidiFilesFromFolder()
  if (!picked) return
  settings.folders = [...new Set([...settings.folders, picked.name])]
  settings.persist()
  if (!picked.files.length) {
    toastStore.showError(`Folder "${picked.name}" không có file MIDI.`)
    return
  }

  toastStore.showLoading(`Đang import ${picked.files.length} file từ "${picked.name}"...`)

  const result = await library.importFiles(picked.files, picked.name)

  if (result.failed.length) {
    toastStore.showError(`Folder "${picked.name}": import ${result.imported} file, lỗi ${result.failed.length}.`)
  } else {
    toastStore.showSuccess(`Folder "${picked.name}": đã import ${result.imported} file MIDI.`)
  }
}
</script>

<template>
  <div class="folder-selector">
    <button class="secondary folder-button" :disabled="!supportsFileSystemAccess()" @click="pick">Songs</button>
    <span class="folder-summary muted">
      {{ supportsFileSystemAccess() ? (settings.folders.join(', ') || 'Choose folder...') : 'Browser không hỗ trợ File System Access API' }}
    </span>
  </div>
</template>

<style scoped>
.folder-selector {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.25rem 0.7rem;
  min-height: 2.42rem;
  min-width: 0;
  padding: 0.06rem 0.18rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.7rem;
  background: #3f3f3f;
}

.folder-button {
  width: auto;
  min-height: 1.9rem;
  padding: 0.26rem 0.58rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.3rem;
  background: #5a5a5a;
  color: #f3f3f3;
  white-space: nowrap;
}

.folder-button:hover {
  background: #666666;
}

.folder-summary,
.folder-message {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.68);
}

.folder-message {
  grid-column: 1 / -1;
  font-size: 0.8rem;
}

@media (max-width: 760px) {
  .folder-selector {
    grid-template-columns: 1fr;
  }
}
</style>
