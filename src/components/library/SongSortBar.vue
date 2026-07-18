<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '../../stores/libraryStore'
import type { SongSortKey } from '../../types/song'

const { t } = useI18n()
const library = useLibraryStore()
const keys: { key: SongSortKey; labelKey: string }[] = [
  { key: 'bestScore', labelKey: 'library.sort.points' },
  { key: 'title', labelKey: 'library.sort.title' },
  { key: 'lastPlayed', labelKey: 'library.sort.lastPlayed' },
  { key: 'duration', labelKey: 'library.sort.duration' },
  { key: 'playCount', labelKey: 'library.sort.playCount' },
  { key: 'rating', labelKey: 'library.sort.rating' },
  { key: 'difficulty', labelKey: 'library.sort.difficulty' },
]
</script>

<template>
  <nav class="sort-bar" :aria-label="t('library.sort.aria')">
    <button
      v-for="item in keys"
      :key="item.key"
      type="button"
      class="sort-cell"
      :class="{ active: library.sortKey === item.key }"
      @click="library.setSort(item.key)"
    >
      <span class="sort-label">{{ t(item.labelKey) }}</span>
      <span v-if="library.sortKey === item.key" class="sort-direction" aria-hidden="true">
        <i :class="library.sortDirection === 'asc' ? 'fa-solid fa-arrow-up' : 'fa-solid fa-arrow-down'" />
      </span>
    </button>
  </nav>
</template>

<style scoped>
.sort-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.12rem;
  padding: 0.18rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.85rem;
  background: #5d5d5d;
}

.sort-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
  min-width: 0;
  padding: 0.34rem 0.66rem;
  border: 0;
  border-radius: 0.68rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.86);
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
}

.sort-cell:hover {
  background: rgba(255, 255, 255, 0.05);
}

.sort-cell.active {
  background: rgba(72, 72, 72, 0.9);
}

.sort-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sort-direction {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.8rem;
}

@media (max-width: 760px) {
  .sort-bar {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }

  .sort-cell {
    justify-content: center;
    padding-inline: 0.38rem;
    font-size: 0.82rem;
  }
}
</style>
