<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../../stores/libraryStore'
import { useToastStore } from '../../stores/toastStore'

const { t } = useI18n()
const library = useLibraryStore()
const toastStore = useToastStore()

function importFailureReason(reason: string) {
  return reason.includes('.') ? t(reason) : reason
}

async function onFiles(files: FileList | null) {
  const selected = files ? [...files] : []
  if (!selected.length) return

  toastStore.showLoading(t('library.importProgress', { count: selected.length }))

  const result = await library.importFiles(selected)

  if (result.failed.length) {
    toastStore.showError(t('library.importFailed', { imported: result.imported, failed: result.failed.length, details: result.failed.map(f => `${f.name} (${importFailureReason(f.reason)})`).join('; ') }))
  } else {
    toastStore.showSuccess(t('library.importSuccess', { count: result.imported }))
  }
}
</script>

<template>
  <div class="midi-import">
    <label class="import-button">
      <input type="file" accept=".mid,.midi,.rmi,.rmid,.musicxml,.xml,.mxl" multiple @change="onFiles(($event.target as HTMLInputElement).files)" />
      {{ t('library.importSongs') }}
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
  border: 1px solid var(--color-border-default);
  border-radius: 0.28rem;
  background: var(--color-btn-secondary-bg);
  color: var(--color-text-primary);
  cursor: pointer;
  white-space: nowrap;
}

.import-button:hover {
  background: var(--color-btn-secondary-hover);
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
  color: var(--color-text-muted);
}
</style>


