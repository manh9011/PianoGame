<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { supportsFileSystemAccess, pickSongFilesFromFolder } from '../../modules/library/fileSystemAccess'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useToastStore } from '../../stores/toastStore'

const { t } = useI18n()
const settings = useSettingsStore()
const library = useLibraryStore()
const toastStore = useToastStore()

async function pick() {
  const picked = await pickSongFilesFromFolder()
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
  }
}
</script>

<template>
  <div class="folder-selector">
    <button class="secondary folder-button" :disabled="!supportsFileSystemAccess()" @click="pick">{{ t('settings.songs') }}</button>
    <span class="folder-summary muted">
      {{ supportsFileSystemAccess() ? (settings.folders.join(', ') || t('library.chooseFolder')) : t('library.folderUnsupported') }}
    </span>
  </div>
</template>

<style scoped>
.folder-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 36px;
  min-width: 0;
  width: 100%;
  padding: 0 0.4rem 0 0.25rem;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  background: var(--color-bg-input);
  box-sizing: border-box;
}

.folder-button {
  width: auto;
  height: 28px;
  padding: 0 0.6rem;
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  background: var(--color-btn-secondary-bg);
  color: var(--color-text-primary);
  white-space: nowrap;
  font-size: 0.85rem;
  cursor: pointer;
}

.folder-button:hover {
  background: var(--color-btn-secondary-bg);
}

.folder-summary,
.folder-message {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
  font-size: 0.88rem;
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


