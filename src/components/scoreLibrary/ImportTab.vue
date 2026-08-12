<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import ImportTaskCard from './ImportTaskCard.vue'
import { importScore, getImportJobs, ApiError } from '../../modules/scoreLibrary/scoreLibraryApi'
import type { ImportJob } from '../../types/scoreLibrary'

const { t } = useI18n()

const STORAGE_KEY = 'scoreLibraryImportTasks'

interface StoredTask {
  id: string
  url: string
  created_at: string
  updated_at: string
  status: string
}

const importUrl = ref('')
const importSubmitting = ref(false)
const importError = ref<string | null>(null)
const tasks = ref<ImportJob[]>([])
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)

function loadPersistedTasks(): StoredTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePersistedTasks(taskList: StoredTask[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(taskList))
}

function getActiveJobIds(): string[] {
  return tasks.value
    .filter(t => t.status !== 'done' && t.status !== 'error' && t.status !== 'failed')
    .map(t => t.id)
}

async function pollTasks() {
  const ids = getActiveJobIds()
  if (ids.length === 0) {
    stopPolling()
    return
  }

  try {
    const result = await getImportJobs(ids)
    const imports = result.imports

    for (const imp of imports) {
      const idx = tasks.value.findIndex(t => t.id === imp.id)
      if (idx >= 0) {
        tasks.value[idx] = imp
      } else {
        tasks.value.unshift(imp)
      }
    }

    tasks.value = [...tasks.value]
    persistTasks()
  } catch {
    // polling error, retry next interval
  }
}

function startPolling() {
  if (pollTimer.value) return
  pollTimer.value = setInterval(pollTasks, 2500)
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

function persistTasks() {
  const persisted: StoredTask[] = tasks.value.map(t => ({
    id: t.id,
    url: t.url,
    created_at: t.created_at,
    updated_at: t.updated_at,
    status: t.status,
  }))
  savePersistedTasks(persisted)
}

async function queueImport(url: string): Promise<boolean> {
  importSubmitting.value = true
  importError.value = null

  try {
    const result = await importScore(url)
    const now = new Date().toISOString()
    const newJob: ImportJob = {
      id: result.jobId,
      url,
      user_id: null,
      score_id: null,
      status: 'processing',
      error: null,
      created_at: now,
      updated_at: now,
    }
    tasks.value.unshift(newJob)
    tasks.value = [...tasks.value]
    persistTasks()

    importUrl.value = ''
    startPolling()
    pollTasks()
    return true
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 409) {
        importError.value = t('scoreLibrary.importError409')
      } else if (e.status === 400) {
        importError.value = t('scoreLibrary.importError400')
      } else {
        importError.value = t('scoreLibrary.importErrorGeneric', { message: e.message })
      }
    } else {
      importError.value = t('scoreLibrary.importErrorNetwork')
    }
    return false
  } finally {
    importSubmitting.value = false
  }
}

async function submitImport() {
  const url = importUrl.value.trim()
  if (!url) return
  await queueImport(url)
}

function deleteTask(job: ImportJob) {
  tasks.value = tasks.value.filter(t => t.id !== job.id)
  persistTasks()
}

async function retryTask(job: ImportJob) {
  if (importSubmitting.value) return
  deleteTask(job)
  await queueImport(job.url)
}

function initFromStorage() {
  const persisted = loadPersistedTasks()
  const jobList: ImportJob[] = persisted.map(p => ({
    id: p.id,
    url: p.url,
    user_id: null,
    score_id: null,
    status: p.status,
    error: null,
    created_at: p.created_at,
    updated_at: p.updated_at || p.created_at,
  }))
  tasks.value = jobList

  if (getActiveJobIds().length > 0) {
    startPolling()
    pollTasks()
  }
}

const emit = defineEmits<{
  'scoreImported': []
}>()

onMounted(() => {
  initFromStorage()
})

onBeforeUnmount(() => {
  stopPolling()
})

defineExpose({ resumePolling: initFromStorage })
</script>

<template>
  <div class="it-root">
    <div class="it-form">
      <h3 class="it-form-title">{{ t('scoreLibrary.importTitle') }}</h3>
      <div class="it-form-row">
        <div class="it-url-input">
          <BaseInput
            v-model="importUrl"
            type="text"
            :placeholder="t('scoreLibrary.importPlaceholder')"
          />
        </div>
        <BaseButton
          variant="primary"
          :disabled="importSubmitting || !importUrl.trim()"
          @click="submitImport"
        >
          {{ importSubmitting ? t('scoreLibrary.importSubmitting') : t('scoreLibrary.importButton') }}
        </BaseButton>
      </div>
      <p v-if="importError" class="it-error">{{ importError }}</p>
    </div>

    <div class="it-task-list">
      <h3 class="it-task-title">{{ t('scoreLibrary.importTaskTitle') }}</h3>
      <div v-if="tasks.length === 0" class="it-empty">
        {{ t('scoreLibrary.importNoTasks') }}
      </div>
      <div v-else class="it-task-items">
        <ImportTaskCard
          v-for="job in tasks"
          :key="job.id"
          :job="job"
          @delete="deleteTask(job)"
          @retry="retryTask(job)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.it-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 16px;
}

.it-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.it-form-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.it-form-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
  width: 100%;
  max-width: 800px;
}

.it-url-input {
  flex: 1;
}
.it-url-input :deep(.base-input) {
  width: 100%;
}

.it-error {
  margin: 0;
  font-size: 0.85rem;
  color: #f44336;
}

.it-task-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.it-task-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
}

.it-task-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 800px;
}

.it-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}
</style>
