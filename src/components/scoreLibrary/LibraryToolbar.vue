<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseInput from '../ui/BaseInput.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import SearchableCombobox from './SearchableCombobox.vue'
import type { AuthorItem, ComposerItem, SortOption, SearchMode } from '../../types/scoreLibrary'

interface Props {
  searchQuery: string
  searchMode: SearchMode
  selectedAuthor: string | null
  selectedComposer: string | null
  sort: SortOption
  authors: AuthorItem[]
  composers: ComposerItem[]
  authorsLoading: boolean
  composersLoading: boolean
}

defineProps<Props>()
const { t } = useI18n()

const emit = defineEmits<{
  'update:searchQuery': [value: string | number]
  'update:searchMode': [value: string | number]
  'update:selectedAuthor': [value: string | null]
  'update:selectedComposer': [value: string | null]
  'update:sort': [value: string | number]
  'clearFilters': []
}>()

const sortOptions = computed(() => [
  { value: 'created_date', label: t('scoreLibrary.sortNewest') },
  { value: 'updated_date', label: t('scoreLibrary.sortRecentlyUpdated') },
  { value: 'views', label: t('scoreLibrary.sortMostViewed') },
  { value: 'downloads', label: t('scoreLibrary.sortMostDownloaded') },
])

const searchModeOptions = computed(() => [
  { value: 'fulltext', label: t('scoreLibrary.searchFullText') },
  { value: 'contains', label: t('scoreLibrary.searchContains') },
])
</script>

<template>
  <div class="lt-root">
    <div class="lt-row">
      <div class="lt-search-input">
        <BaseInput
          :model-value="searchQuery"
          type="text"
          :placeholder="t('scoreLibrary.searchTitlePlaceholder')"
          @update:model-value="emit('update:searchQuery', $event)"
        />
      </div>
      <BaseSelect
        :model-value="searchMode"
        :options="searchModeOptions"
        class="lt-search-mode"
        @update:model-value="emit('update:searchMode', $event as SearchMode)"
      />
      <SearchableCombobox
        :model-value="selectedAuthor"
        :items="authors"
        :placeholder="t('scoreLibrary.authorPlaceholder')"
        :loading="authorsLoading"
        class="lt-combo"
        @update:model-value="emit('update:selectedAuthor', $event)"
      />
      <SearchableCombobox
        :model-value="selectedComposer"
        :items="composers"
        :placeholder="t('scoreLibrary.composerPlaceholder')"
        :loading="composersLoading"
        class="lt-combo"
        @update:model-value="emit('update:selectedComposer', $event)"
      />
      <BaseSelect
        :model-value="sort"
        :options="sortOptions"
        class="lt-sort"
        @update:model-value="emit('update:sort', $event as SortOption)"
      />
      <button
        v-if="searchQuery || selectedAuthor || selectedComposer || sort !== 'created_date'"
        class="lt-clear-btn"
        @click="emit('clearFilters')"
      >
        {{ t('scoreLibrary.clearFilters') }}
      </button>
    </div>
    </div>
</template>

<style scoped>
.lt-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
}

.lt-search-input {
  flex: 3 1 160px;
  min-width: 120px;
}
.lt-search-input :deep(.base-input) {
  width: 100%;
}

.lt-search-mode {
  flex: 0 0 110px;
}

.lt-combo {
  width: 180px;
  flex-shrink: 0;
}

.lt-sort {
  flex: 0 0 170px;
}

.lt-clear-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}

.lt-clear-btn:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}

@media (max-width: 700px) {
  .lt-row {
    flex-direction: column;
  }

  .lt-search-input {
    flex: 1 1 auto;
    width: 100%;
  }
}
</style>
