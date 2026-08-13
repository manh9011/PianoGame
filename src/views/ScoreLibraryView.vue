<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/libraryStore'
import { useToastStore } from '../stores/toastStore'
import BaseTabs from '../components/ui/BaseTabs.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import LibraryToolbar from '../components/scoreLibrary/LibraryToolbar.vue'
import ScoreGrid from '../components/scoreLibrary/ScoreGrid.vue'
import ScoreDetailDialog from '../components/scoreLibrary/ScoreDetailDialog.vue'
import ScoreLibraryHelp from '../components/scoreLibrary/ScoreLibraryHelp.vue'
import ImportTab from '../components/scoreLibrary/ImportTab.vue'
import {
  listScores,
  getScore,
  fetchMidiBlob,
  listAuthors,
  listComposers,
} from '../modules/scoreLibrary/scoreLibraryApi'
import type {
  ScoreLibraryItem,
  ScorePagination,
  AuthorItem,
  ComposerItem,
  SortOption,
  SearchMode,
} from '../types/scoreLibrary'

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const toastStore = useToastStore()

const activeTab = ref('library')

const tabs = computed(() => [
  { id: 'library', label: t('scoreLibrary.tabLibrary') },
  { id: 'import', label: t('scoreLibrary.tabImport') },
])

// ---- Library State ----
const scores = ref<ScoreLibraryItem[]>([])
const pagination = ref<ScorePagination>({ page: 1, limit: 20, total: 0, total_pages: 0 })
const searchQuery = ref('')
const searchMode = ref<SearchMode>('fulltext')
const selectedAuthor = ref<string | null>(null)
const selectedComposer = ref<string | null>(null)
const sort = ref<SortOption>('created_date')
const page = ref(1)
const libraryLoading = ref(false)
const libraryError = ref<string | null>(null)
const authors = ref<AuthorItem[]>([])
const composers = ref<ComposerItem[]>([])
const authorsLoading = ref(false)
const composersLoading = ref(false)

// ---- Detail State ----
const selectedScore = ref<ScoreLibraryItem | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const midiBlob = ref<Blob | null>(null)
const midiLoading = ref(false)
const playLoading = ref(false)

// ---- Help ----
const helpOpen = ref(false)

// ---- Search debounce ----
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

function debouncedFetchScores() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    fetchScores()
  }, 300)
}

// ---- API Calls ----
async function fetchScores() {
  libraryLoading.value = true
  libraryError.value = null

  if (abortController) abortController.abort()
  abortController = new AbortController()

  try {
    const params: Record<string, unknown> = {
      page: page.value,
      limit: 20,
      sort: sort.value,
      order: sort.value === 'views' || sort.value === 'downloads' || sort.value === 'created_date' || sort.value === 'updated_date' ? 'desc' : 'asc',
    }

    if (searchQuery.value.trim()) {
      params.q = searchQuery.value.trim()
      params.mode = searchMode.value
      if (searchMode.value === 'contains') {
        params.field = 'title'
      }
    } else if (selectedAuthor.value) {
      params.q = selectedAuthor.value
      params.mode = 'contains'
      params.field = 'author'
    } else if (selectedComposer.value) {
      params.q = selectedComposer.value
      params.mode = 'contains'
      params.field = 'composer'
    }

    const result = await listScores(params as Parameters<typeof listScores>[0])
    scores.value = result.data
    pagination.value = result.pagination
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    libraryError.value = t('scoreLibrary.unableToLoadScores')
  } finally {
    libraryLoading.value = false
  }
}

async function fetchAuthorsList() {
  authorsLoading.value = true
  try {
    const result = await listAuthors()
    authors.value = result.data
  } catch {
    // silent
  } finally {
    authorsLoading.value = false
  }
}

async function fetchComposersList() {
  composersLoading.value = true
  try {
    const result = await listComposers()
    composers.value = result.data
  } catch {
    // silent
  } finally {
    composersLoading.value = false
  }
}

async function openDetail(score: ScoreLibraryItem) {
  selectedScore.value = score
  detailOpen.value = true
  detailLoading.value = true
  midiBlob.value = null

  try {
    const detail = await getScore(score.user_id, score.score_id)
    selectedScore.value = detail
  } catch {
    // keep list data if detail fails
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  selectedScore.value = null
  midiBlob.value = null
}

async function handleDownload(score: ScoreLibraryItem) {
  try {
    if (!midiBlob.value) {
      midiLoading.value = true
      midiBlob.value = await fetchMidiBlob(score.user_id, score.score_id)
      midiLoading.value = false
    }
    const blob = midiBlob.value
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeTitle = score.title.replace(/[\\/:*?"<>|]/g, '_')
    a.href = url
    a.download = `${safeTitle}.mid`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    if (selectedScore.value) {
      selectedScore.value = { ...selectedScore.value, downloads: selectedScore.value.downloads + 1 }
    }
  } catch (e) {
    toastStore.showError(t('scoreLibrary.downloadFailed'))
  }
}

async function handlePlay(score: ScoreLibraryItem) {
  playLoading.value = true
  try {
    if (!midiBlob.value) {
      midiLoading.value = true
      midiBlob.value = await fetchMidiBlob(score.user_id, score.score_id)
      midiLoading.value = false
    }
    const file = new File([midiBlob.value], `${score.title}.mid`, { type: 'audio/midi' })
    const imported = await libraryStore.importFile(file)
    const hash = imported.playbackHash ?? imported.hash
    if (hash) {
      closeDetail()
      router.push(`/mode-select/${hash}`)
    }
  } catch (e) {
    toastStore.showError(t('scoreLibrary.playFailed'))
  } finally {
    playLoading.value = false
  }
}

// ---- Watchers ----
watch([searchQuery, searchMode, selectedAuthor, selectedComposer, sort], () => {
  page.value = 1
  if (searchQuery.value.trim() || selectedAuthor.value || selectedComposer.value) {
    debouncedFetchScores()
  } else {
    fetchScores()
  }
})

watch(page, () => {
  fetchScores()
  const grid = document.querySelector('.sl-content')
  grid?.scrollIntoView({ behavior: 'smooth' })
})

function clearFilters() {
  searchQuery.value = ''
  selectedAuthor.value = null
  selectedComposer.value = null
  sort.value = 'created_date'
}

function goToPage(p: number) {
  if (p >= 1 && p <= pagination.value.total_pages) {
    page.value = p
  }
}

// ---- Init ----
fetchScores()
fetchAuthorsList()
fetchComposersList()

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (abortController) abortController.abort()
})
</script>

<template>
  <div class="sl-root">
    <!-- Topbar -->
    <header class="sl-topbar">
      <div class="sl-top-left">
        <BaseButton variant="secondary" size="md" @click="router.push('/')">
          ← {{ t('scoreLibrary.back') }}
        </BaseButton>
        <BaseButton variant="secondary" size="md" :disabled="libraryLoading" @click="fetchScores">
          ⟳ {{ t('scoreLibrary.refresh') }}
        </BaseButton>
      </div>
      <div class="sl-top-center">
        <BaseTabs v-model="activeTab" :tabs="tabs" />
      </div>
      <div class="sl-top-right">
        <BaseButton variant="secondary" size="md" @click="helpOpen = true">
          {{ t('scoreLibrary.help') }}
        </BaseButton>
      </div>
    </header>

    <!-- Toolbar (sticky) -->
    <div v-if="activeTab === 'library'" class="sl-toolbar-wrap">
      <LibraryToolbar
        v-model:search-query="searchQuery"
        v-model:search-mode="searchMode"
        v-model:selected-author="selectedAuthor"
        v-model:selected-composer="selectedComposer"
        v-model:sort="sort"
        :authors="authors"
        :composers="composers"
        :authors-loading="authorsLoading"
        :composers-loading="composersLoading"
        class="sl-toolbar"
        @clear-filters="clearFilters"
      />
    </div>

    <!-- Content -->
    <div class="sl-content">
      <template v-if="activeTab === 'library'">
        <!-- Error State -->
        <div v-if="libraryError" class="sl-error">
          <p>{{ t('scoreLibrary.unableToLoadScores') }}</p>
          <BaseButton variant="secondary" size="sm" @click="fetchScores">{{ t('scoreLibrary.retry') }}</BaseButton>
        </div>

        <!-- Empty State -->
        <div v-else-if="!libraryLoading && scores.length === 0" class="sl-empty">
          <p>{{ t('scoreLibrary.noScoresFound') }}</p>
          <p class="sl-empty-hint">{{ t('scoreLibrary.noScoresHint') }}</p>
        </div>

        <!-- Grid -->
        <template v-else>
          <ScoreGrid
            :scores="scores"
            :loading="libraryLoading"
            @select="openDetail"
          />

          <!-- Pagination -->
          <div v-if="pagination.total_pages > 1" class="sl-pagination">
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
            >
              {{ t('scoreLibrary.prev') }}
            </BaseButton>
            <span class="sl-page-info">
              {{ t('scoreLibrary.pageInfo', { page: pagination.page, totalPages: pagination.total_pages }) }}
              <span class="sl-page-total">{{ t('scoreLibrary.pageTotal', { total: pagination.total }) }}</span>
            </span>
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page >= pagination.total_pages"
              @click="goToPage(page + 1)"
            >
              {{ t('scoreLibrary.next') }}
            </BaseButton>
          </div>
        </template>
      </template>

      <template v-else>
        <ImportTab @score-imported="fetchScores" />
      </template>
    </div>

    <!-- Detail Dialog -->
    <ScoreDetailDialog
      :show="detailOpen"
      :score="selectedScore"
      :detail-loading="detailLoading"
      :midi-blob="midiBlob"
      :midi-loading="midiLoading"
      :play-loading="playLoading"
      @close="closeDetail"
      @download="handleDownload"
      @play="handlePlay"
      @midi-ready="(blob: Blob) => midiBlob = blob"
    />

    <!-- Help Dialog -->
    <ScoreLibraryHelp
      :show="helpOpen"
      @close="helpOpen = false"
    />
  </div>
</template>

<style scoped>
.sl-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.sl-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border-default);
  gap: 12px;
  flex-shrink: 0;
  min-height: 44px;
}

.sl-top-left,
.sl-top-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sl-top-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.sl-toolbar-wrap {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-default);
  padding: 8px 16px;
}

.sl-toolbar {
  max-width: 100%;
}

.sl-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 24px;
}

.sl-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  text-align: center;
  color: var(--color-text-secondary);
}

.sl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--color-text-secondary);
}

.sl-empty-hint {
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.sl-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0 8px;
}

.sl-page-info {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.sl-page-total {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

@media (max-width: 500px) {
  .sl-topbar {
    flex-wrap: wrap;
    padding: 6px 10px;
    gap: 6px;
  }

  .sl-top-center {
    order: 3;
    flex: 0 0 100%;
    justify-content: center;
  }

  .sl-toolbar-wrap {
    padding: 6px 10px;
  }

  .sl-pagination {
    flex-wrap: wrap;
  }
}
</style>
