<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'

const { t, n } = useI18n()
const player = usePlayerStore()

const visible = computed(() => player.loopRegionConfigured && player.session?.modeConfig.scoringEnabled && (player.playbackRunning || player.loopAttemptHistory.length > 0))
const attempts = computed(() => player.recentLoopAttempts)
const best = computed(() => player.bestLoopAttempt)
const average = computed(() => {
  if (!attempts.value.length) return null
  const totals = attempts.value.reduce((acc, attempt) => ({
    score: acc.score + attempt.score,
    errors: acc.errors + attempt.errorCount,
    notes: acc.notes + attempt.totalNotes,
  }), { score: 0, errors: 0, notes: 0 })
  return {
    score: Math.round(totals.score / attempts.value.length),
    errorCount: Math.round(totals.errors / attempts.value.length),
    totalNotes: Math.round(totals.notes / attempts.value.length),
  }
})

function formatScore(score: number) {
  return n(score)
}
</script>

<template>
  <aside v-if="visible" class="loop-performance-overlay">
    <div class="loop-performance-grid loop-performance-grid--header">
      <span>{{ t('loopStats.shortIndex') }}</span>
      <span>{{ t('loopStats.shortPoint') }}</span>
      <span>{{ t('loopStats.shortError') }}</span>
    </div>
    <div v-if="attempts.length" class="loop-performance-list">
      <div v-for="attempt in attempts" :key="attempt.id" class="loop-performance-grid">
        <span>{{ attempt.loopIndex }}</span>
        <strong>{{ formatScore(attempt.score) }}</strong>
        <span>{{ attempt.errorCount }}/{{ attempt.totalNotes }}</span>
      </div>
    </div>
    <p v-else class="loop-performance-empty">{{ t('loopStats.empty') }}</p>
    <div v-if="average" class="loop-performance-grid loop-performance-average">
      <span>{{ t('loopStats.avgShort') }}</span>
      <strong>{{ formatScore(average.score) }}</strong>
      <span>{{ average.errorCount }}/{{ average.totalNotes }}</span>
    </div>
    <div v-if="best" class="loop-performance-grid loop-performance-best">
      <span>{{ t('loopStats.bestShort') }} (#{{ best.loopIndex }})</span>
      <strong>{{ formatScore(best.score) }}</strong>
      <span>{{ best.errorCount }}/{{ best.totalNotes }}</span>
    </div>
  </aside>
</template>

<style scoped>
.loop-performance-overlay {
  position: absolute;
  z-index: 9;
  top: 4.2rem;
  right: 0.5rem;
  width: max-content;
  min-width: 0;
  padding: 0.25rem 0.45rem;
  border-radius: 4px;
  background: transparent;
  color: rgba(245, 250, 255, 0.94);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 8px rgba(3, 15, 28, 0.85);
  pointer-events: none;
}

.loop-performance-grid {
  display: grid;
  grid-template-columns: 2.2rem 5.4rem 4rem;
  gap: 0.35rem;
  align-items: baseline;
  padding: 0.05rem 0;
  font-size: 0.78rem;
  line-height: 1.12;
  text-align: right;
}

.loop-performance-grid span:first-child {
  text-align: left;
}

.loop-performance-grid--header {
  margin-bottom: 0.12rem;
  color: #c9cdd3;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}

.loop-performance-list {
  max-height: 8.8rem;
  overflow: hidden;
}

.loop-performance-empty {
  margin: 0.15rem 0 0;
  color: rgba(227, 228, 232, 0.72);
  font-size: 0.72rem;
}

.loop-performance-average,
.loop-performance-best {
  margin-top: 0.12rem;
  padding-top: 0.12rem;
  color: #d8f999;
  font-weight: 700;
}

.loop-performance-average {
  color: #c9cdd3;
}

.loop-performance-grid strong {
  font-weight: 800;
}
</style>
