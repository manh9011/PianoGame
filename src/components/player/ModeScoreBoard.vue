<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'
import { useProfileStore } from '../../stores/profileStore'
import type { HandSelection, PlayMode } from '../../modules/game/playSession'

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
        <div v-for="entry in rows.filter(row => row.mode === mode)" :key="`${entry.mode}-${entry.handSelection}-${entry.playedAt}`" class="board-row">
          <span>{{ t(handLabelKeys[entry.handSelection]) }}</span>
          <span>{{ entry.gameplayPoints ?? 0 }}</span>
          <span>{{ entry.grade }}</span>
          <span>{{ entry.notesHit ?? percent(entry.accuracy) }}</span>
          <span>{{ entry.errors ?? 0 }}</span>
          <span>{{ formatDuration(entry.timeSpentUs) }}</span>
          <span v-if="entry.perfect">{{ t('score.perfect') }}</span>
        </div>
      </div>
    </div>
    <p v-else class="muted">{{ t('score.empty') }}</p>
  </section>
</template>

<style scoped>
.score-board { display: grid; gap: 0.75rem; }
.board-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
.board-column { display: grid; align-content: start; gap: 0.45rem; border: 1px solid var(--color-border-default); border-radius: 12px; padding: 0.75rem; }
.board-row { display: grid; grid-template-columns: 1fr auto auto auto auto auto; gap: 0.4rem; font-size: 0.9rem; }
</style>
