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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.25rem 0.7rem;
  min-height: 2.42rem;
  min-width: 0;
  padding: 0.06rem 0.18rem;
  border: 1px solid var(--color-border-input);
  border-radius: 0.7rem;
  background: var(--color-bg-input);
}

.folder-button {
  width: auto;
  min-height: 1.9rem;
  padding: 0.26rem 0.58rem;
  border: 1px solid var(--color-border-input);
  border-radius: 0.3rem;
  background: var(--color-btn-secondary-bg);
  color: var(--color-text-primary);
  white-space: nowrap;
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


