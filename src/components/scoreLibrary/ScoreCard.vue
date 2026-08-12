<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ScoreLibraryItem } from '../../types/scoreLibrary'

interface Props {
  score: ScoreLibraryItem
}

defineProps<Props>()

const { t } = useI18n()

const emit = defineEmits<{
  click: [score: ScoreLibraryItem]
}>()

const PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" fill="%23333"><rect width="300" height="400"/><text x="150" y="200" text-anchor="middle" fill="%23666" font-size="18" font-family="sans-serif">No Image</text></svg>'
)

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.src !== PLACEHOLDER_SVG) {
    img.src = PLACEHOLDER_SVG
  }
}
</script>

<template>
  <button
    class="sc-card"
    @click="emit('click', score)"
  >
    <div class="sc-card-img-wrap">
      <img
        :src="score.image"
        :alt="score.title"
        class="sc-card-img"
        loading="lazy"
        @error="onImgError"
      />
    </div>
    <div class="sc-card-body">
      <h3 class="sc-card-title">{{ score.title }}</h3>
      <p v-if="score.author" class="sc-card-meta">{{ score.author }}</p>
      <p v-if="score.composer" class="sc-card-meta sc-card-composer">{{ score.composer }}</p>
      <div class="sc-card-stats">
        <span class="sc-stat">{{ score.views }} <span class="sc-stat-label">{{ t('scoreLibrary.views') }}</span></span>
        <span class="sc-stat">{{ score.downloads }} <span class="sc-stat-label">{{ t('scoreLibrary.downloads') }}</span></span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.sc-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-default);
  border-radius: 10px;
  background: var(--color-bg-card);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  text-align: left;
  padding: 0;
}

.sc-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-strong);
  background: var(--color-bg-card-hover);
}

.sc-card-img-wrap {
  aspect-ratio: 3 / 4;
  overflow: hidden;
  /* Sheet thumbnails: PNG có nền trong suốt, luôn đặt nền trắng */
  background: #fff;
}

.sc-card-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.sc-card-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sc-card-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sc-card-meta {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.sc-card-composer {
  color: var(--color-text-muted);
}

.sc-card-stats {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}

.sc-stat {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.sc-stat-label {
  font-weight: 400;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
</style>
