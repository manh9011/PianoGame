<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supportsFileSystemAccess, pickSongFilesFromFolder, rescanSongFilesFromFolder, type PickedSongFolder } from '../../modules/library/fileSystemAccess'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useToastStore } from '../../stores/toastStore'

const { t } = useI18n()
const library = useLibraryStore()
const settings = useSettingsStore()
const toastStore = useToastStore()

const availableFolders = computed(() => {
  const set = new Set<string>()
  for (const f of settings.folders) {
    if (f) set.add(f)
  }
  for (const song of library.songs) {
    if (song.folderPath) set.add(song.folderPath)
  }
  return Array.from(set)
})

onMounted(() => {
  if (settings.songsRememberLastFolder && settings.lastSelectedFolder) {
    library.setSelectedFolder(settings.lastSelectedFolder)
  }
})

function selectFolder(folderKey: string) {
  library.setSelectedFolder(folderKey)
  if (settings.songsRememberLastFolder) {
    settings.patchSettings({ lastSelectedFolder: folderKey })
  }
}

async function refreshFolder() {
  const currentFolder = library.selectedFolder
  let picked: PickedSongFolder | null = null

  if (currentFolder && currentFolder !== 'all' && currentFolder !== 'imported') {
    // Automatic silent rescan of the currently active folder
    toastStore.showLoading(t('library.folderImporting', { count: 0, name: currentFolder }))
    picked = await rescanSongFilesFromFolder(currentFolder)
  } else if (currentFolder === 'all' && settings.folders.length > 0) {
    // Rescan all saved folders automatically
    toastStore.showLoading(t('library.folderImporting', { count: 0, name: t('library.allFolders') }))
    let totalImported = 0
    for (const folderName of settings.folders) {
      const result = await rescanSongFilesFromFolder(folderName)
      if (result && result.files.length) {
        const importRes = await library.importFiles(result.files, result.name)
        totalImported += importRes.imported
      }
    }
    toastStore.showSuccess(t('library.folderImportSuccess', { name: t('library.allFolders'), count: totalImported }))
    return
  } else {
    picked = await pickSongFilesFromFolder()
  }

  if (!picked) return
  settings.folders = [...new Set([...settings.folders, picked.name])]
  settings.persist()
  if (!picked.files.length) {
    toastStore.showError(t('library.folderNoSupportedFiles', { name: picked.name }))
    return
  }

  toastStore.showLoading(t('library.folderImporting', { count: picked.files.length, name: picked.name }))

  const result = await library.importFiles(picked.files, picked.name)

  if (result.failed.length) {
    toastStore.showError(t('library.folderImportFailed', { name: picked.name, imported: result.imported, failed: result.failed.length }))
  } else {
    toastStore.showSuccess(t('library.folderImportSuccess', { name: picked.name, count: result.imported }))
    selectFolder(picked.name)
  }
}
</script>

<template>
  <div class="folder-toggle-container">
    <nav class="folder-toggle-bar" aria-label="Folder filter">
      <!-- All Folders -->
      <button
        type="button"
        class="folder-toggle-btn"
        :class="{ active: library.selectedFolder === 'all' }"
        @click="selectFolder('all')"
      >
        <i class="fa-solid fa-folder-open icon" aria-hidden="true" />
        <span>{{ t('library.allFolders') }}</span>
      </button>

      <!-- Folders List -->
      <button
        v-for="folder in availableFolders"
        :key="folder"
        type="button"
        class="folder-toggle-btn"
        :class="{ active: library.selectedFolder === folder }"
        @click="selectFolder(folder)"
      >
        <i class="fa-regular fa-folder icon" aria-hidden="true" />
        <span class="folder-name" :title="folder">{{ folder }}</span>
      </button>

      <!-- Imported Folder -->
      <button
        type="button"
        class="folder-toggle-btn"
        :class="{ active: library.selectedFolder === 'imported' }"
        @click="selectFolder('imported')"
      >
        <i class="fa-solid fa-file-import icon" aria-hidden="true" />
        <span>{{ t('library.importedFolder') }}</span>
      </button>
    </nav>

    <button
      v-if="library.selectedFolder !== 'all' && library.selectedFolder !== 'imported'"
      type="button"
      class="folder-add-btn"
      :disabled="!supportsFileSystemAccess()"
      :title="t('library.rescanFolder')"
      :aria-label="t('library.rescanFolder')"
      @click="refreshFolder"
    >
      <i class="fa-solid fa-rotate-right" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.folder-toggle-container {
  display: flex;
  align-items: center;
  width: 100%;
  height: 38px;
  padding: 3px 4px;
  border: 1px solid var(--color-border-input, rgba(255, 255, 255, 0.16));
  border-radius: 8px;
  background: var(--color-bg-input, rgba(0, 0, 0, 0.35));
  box-sizing: border-box;
}

.folder-toggle-bar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  width: 100%;
  height: 100%;
}

.folder-toggle-bar::-webkit-scrollbar {
  display: none;
}

.folder-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 30px;
  padding: 0 0.75rem;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-secondary, #9da3ae);
  font-size: 0.86rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.folder-toggle-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary, #ffffff);
}

.folder-toggle-btn.active {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  font-weight: 600;
}

.icon {
  font-size: 0.82rem;
  opacity: 0.85;
}

.folder-toggle-btn.active .icon {
  opacity: 1;
}

.folder-name {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-add-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: 0.25rem;
  margin-right: 0.15rem;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary, #ffffff);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.folder-add-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.folder-add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .folder-name {
    max-width: 8rem;
  }
}
</style>
