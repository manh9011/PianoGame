<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatDateTime } from '../../i18n/formatters'
import type { SupportedLocale } from '../../i18n'
import type { ImportJob } from '../../types/scoreLibrary'

interface Props {
  job: ImportJob
}

defineProps<Props>()
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
      <span class="itc-status-badge">{{ statusLabel(job.status) }}</span>
    </div>
    <div class="itc-meta">
      <span v-if="job.created_at">{{ fmtDate(job.created_at) }}</span>
      <span v-if="job.updated_at">{{ fmtDate(job.updated_at) }}</span>
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
  align-items: center;
  gap: 8px;
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

.itc-error {
  font-size: 0.8rem;
  color: #f44336;
  margin-top: 2px;
}
</style>
