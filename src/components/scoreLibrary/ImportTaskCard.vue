<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatDateTime } from '../../i18n/formatters'
import type { SupportedLocale } from '../../i18n'
import type { ImportJob } from '../../types/scoreLibrary'

interface Props {
  job: ImportJob
}

defineProps<Props>()
const emit = defineEmits<{
  delete: [job: ImportJob]
  retry: [job: ImportJob]
}>()
const { t, locale } = useI18n()

function fmtDate(iso: string): string {
  if (!iso) return ''
  return formatDateTime(new Date(iso), locale.value as SupportedLocale)
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: t('scoreLibrary.importStatusQueued'),
    processing: t('scoreLibrary.importStatusProcessing'),
    done: t('scoreLibrary.importStatusDone'),
    failed: t('scoreLibrary.importStatusFailed'),
    error: t('scoreLibrary.importStatusFailed'),
  }
  return map[status] ?? status
}</script>

<template>
  <div class="itc-root" :class="'itc-status-' + job.status">
    <div class="itc-top">
      <span class="itc-url">{{ job.url }}</span>
      <div class="itc-top-right">
        <span class="itc-status-badge">{{ statusLabel(job.status) }}</span>
        <div v-if="job.status === 'failed' || job.status === 'error'" class="itc-actions">
          <button
            class="itc-action"
            :title="t('scoreLibrary.importTaskRetry')"
            :aria-label="t('scoreLibrary.importTaskRetry')"
            @click="emit('retry', job)"
          >
            <i class="fa-solid fa-rotate" />
          </button>
          <button
            class="itc-action itc-action-danger"
            :title="t('scoreLibrary.importTaskDelete')"
            :aria-label="t('scoreLibrary.importTaskDelete')"
            @click="emit('delete', job)"
          >
            <i class="fa-solid fa-trash" />
          </button>
        </div>
        <button
          v-else-if="job.status === 'done'"
          class="itc-action itc-action-danger"
          :title="t('scoreLibrary.importTaskDelete')"
          :aria-label="t('scoreLibrary.importTaskDelete')"
          @click="emit('delete', job)"
        >
          <i class="fa-solid fa-trash" />
        </button>
      </div>
    </div>
    <div class="itc-meta">
      <span v-if="job.created_at">
        <span class="itc-meta-label">{{ t('scoreLibrary.metaCreated') }}:</span>
        {{ fmtDate(job.created_at) }}
      </span>
      <span v-if="job.updated_at">
        <span class="itc-meta-label">{{ t('scoreLibrary.metaUpdated') }}:</span>
        {{ fmtDate(job.updated_at) }}
      </span>
      <span v-if="job.user_id && job.score_id">
        ID: {{ job.user_id }}/{{ job.score_id }}
      </span>
    </div>
    <div v-if="job.error" class="itc-error">{{ job.error }}</div>
  </div>
</template>

<style scoped>
.itc-root {
  padding: 10px 12px;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-bg-card);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.itc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.itc-top-right {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.itc-url {
  font-size: 0.85rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itc-status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: capitalize;
  flex-shrink: 0;
}

.itc-status-done .itc-status-badge {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}

.itc-status-processing .itc-status-badge,
.itc-status-queued .itc-status-badge {
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
}

.itc-status-failed .itc-status-badge,
.itc-status-error .itc-status-badge {
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
}

.itc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.itc-meta-label {
  font-weight: 600;
}

.itc-error {
  font-size: 0.8rem;
  color: #f44336;
  margin-top: 2px;
}

.itc-actions {
  display: flex;
  gap: 6px;
}

.itc-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 7px;
  font-size: 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.2s ease;
}

.itc-action:hover {
  background: rgba(255, 255, 255, 0.1);
}

.itc-action-danger:hover {
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
}
</style>
