<script setup lang="ts">
import type { ScoreLibraryItem } from '../../types/scoreLibrary'
import ScoreCard from './ScoreCard.vue'

interface Props {
  scores: ScoreLibraryItem[]
  loading: boolean
  skeletonCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  skeletonCount: 8,
})

const emit = defineEmits<{
  'select': [score: ScoreLibraryItem]
}>()
</script>

<template>
  <div class="sg-grid">
    <template v-if="loading">
      <div v-for="i in skeletonCount" :key="'sk-' + i" class="sg-skeleton-card">
        <div class="sg-skeleton-img" />
        <div class="sg-skeleton-body">
          <div class="sg-skeleton-line sg-skeleton-title" />
          <div class="sg-skeleton-line sg-skeleton-meta" />
          <div class="sg-skeleton-line sg-skeleton-meta-short" />
        </div>
      </div>
    </template>
    <ScoreCard
      v-for="score in scores"
      :key="`${score.user_id}-${score.score_id}`"
      :score="score"
      @click="emit('select', score)"
    />
  </div>
</template>

<style scoped>
.sg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 12px 0;
}

@media (max-width: 600px) {
  .sg-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

.sg-skeleton-card {
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
}

.sg-skeleton-img {
  aspect-ratio: 3 / 4;
  background: var(--color-bg-secondary);
  animation: sg-pulse 1.4s ease-in-out infinite;
}

.sg-skeleton-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sg-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: var(--color-bg-secondary);
  animation: sg-pulse 1.4s ease-in-out infinite;
}

.sg-skeleton-title {
  width: 75%;
}

.sg-skeleton-meta {
  width: 50%;
}

.sg-skeleton-meta-short {
  width: 35%;
}

@keyframes sg-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
</style>
