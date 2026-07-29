<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'
import { useProfileStore } from '../../stores/profileStore'
import type { HandSelection, PlayMode } from '../../modules/game/playSession'
import BaseTable, { type TableColumn } from '../ui/BaseTable.vue'

const { t } = useI18n()
const player = usePlayerStore()
const profiles = useProfileStore()
const modes: PlayMode[] = ['noteMemory', 'practice', 'performance']
const handLabelKeys: Record<HandSelection, string> = { left: 'modeSelect.hands.left', right: 'modeSelect.hands.right', both: 'modeSelect.hands.both' }
const modeTitleKeys: Record<PlayMode, string> = {
  listen: 'modeSelect.modes.listen',
  noteMemory: 'modeSelect.columns.noteMemoryTitle',
  practice: 'modeSelect.columns.practiceTitle',
  performance: 'modeSelect.columns.performanceTitle',
}

const columns: TableColumn[] = [
  { key: 'hand', width: 'auto' },
  { key: 'points', width: 'auto', align: 'right' },
  { key: 'grade', width: 'auto', align: 'center' },
  { key: 'accuracy', width: 'auto', align: 'right' },
  { key: 'errors', width: 'auto', align: 'right' },
  { key: 'duration', width: 'auto', align: 'right' },
  { key: 'perfect', width: 'auto', align: 'center' }
]
const rows = computed(() => {
  const songId = player.song?.id
  if (!songId) return []
  return Object.values(profiles.activeProfile.scoresByMode)
    .flatMap(entries => entries ?? [])
    .filter(entry => entry.songId === songId)
    .sort((a, b) => (b.gameplayPoints ?? 0) - (a.gameplayPoints ?? 0) || b.playedAt - a.playedAt)
})
function percent(value: number) { return `${Math.round(value * 100)}%` }
function formatDuration(us?: number) {
  if (!us) return '-'
  const totalSeconds = Math.round(us / 1_000_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
</script>

<template>
  <section class="score-board">
    <h3>{{ t('score.boardTitle') }}</h3>
    <div v-if="rows.length" class="board-grid">
      <div v-for="mode in modes" :key="mode" class="board-column">
        <strong>{{ t(modeTitleKeys[mode]) }}</strong>
        <BaseTable
          v-if="rows.filter(row => row.mode === mode).length"
          :columns="columns"
          :data="rows.filter(row => row.mode === mode)"
          row-key="playedAt"
          hide-header
          :hoverable="false"
          class="board-table"
        >
          <template #cell-hand="{ item }">
            {{ t(handLabelKeys[item.handSelection as HandSelection]) }}
          </template>
          <template #cell-points="{ item }">
            {{ item.gameplayPoints ?? 0 }}
          </template>
          <template #cell-grade="{ item }">
            {{ item.grade }}
          </template>
          <template #cell-accuracy="{ item }">
            {{ item.notesHit ?? percent(item.accuracy) }}
          </template>
          <template #cell-errors="{ item }">
            {{ item.errors ?? 0 }}
          </template>
          <template #cell-duration="{ item }">
            {{ formatDuration(item.timeSpentUs) }}
          </template>
          <template #cell-perfect="{ item }">
            <span v-if="item.perfect">{{ t('score.perfect') }}</span>
          </template>
        </BaseTable>
      </div>
    </div>
    <p v-else class="muted">{{ t('score.empty') }}</p>
  </section>
</template>

<style scoped>
.score-board { display: grid; gap: 0.75rem; }
.board-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
.board-column { display: grid; align-content: start; gap: 0.45rem; border: 1px solid var(--color-border-default); border-radius: 12px; padding: 0.75rem; overflow-x: auto; }
.board-table { margin-top: 0.2rem; }
:deep(.base-table-row) { font-size: 0.9rem; }
:deep(.base-table td) { padding: 0.2rem 0.4rem; border: none; }
:deep(.base-table td:first-child) { padding-left: 0; }
:deep(.base-table td:last-child) { padding-right: 0; }
:deep(.base-table tr) { border-bottom: none; }
</style>
