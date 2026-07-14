<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../../stores/libraryStore'
import { useToastStore } from '../../stores/toastStore'

const { t } = useI18n()
const library = useLibraryStore()
const toastStore = useToastStore()

async function onFiles(files: FileList | null) {
  const selected = files ? [...files] : []
  if (!selected.length) return

  toastStore.showLoading(t('library.importProgress', { count: selected.length }))

  const result = await library.importFiles(selected)

  if (result.failed.length) {
    toastStore.showError(t('library.importFailed', { imported: result.imported, failed: result.failed.length, details: result.failed.map(f => `${f.name} (${f.reason})`).join('; ') }))
  } else {
    toastStore.showSuccess(t('library.importSuccess', { count: result.imported }))
  }
}
</script>

<template>
  <div class="midi-import">
    <label class="import-button">
      <input type="file" accept=".mid,.midi,.rmi,.rmid" multiple @change="onFiles(($event.target as HTMLInputElement).files)" />
      {{ t('library.importMidi') }}
    </label>
  </div>
</template>

<style scoped>
.midi-import {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.import-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-height: 2rem;
  padding: 0.3rem 0.82rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0.28rem;
  background: #666666;
  color: rgba(255, 255, 255, 0.96);
  cursor: pointer;
  white-space: nowrap;
}

.import-button:hover {
  background: #727272;
}

.import-button input {
  display: none;
}

.import-message {
  max-width: 16rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.56);
}
</style>
