<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SongMetadata } from '../../types/song'
import { useLibraryStore } from '../../stores/libraryStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useToastStore } from '../../stores/toastStore'
import { formatDate, formatDateTime } from '../../i18n/formatters'
import { achievementColorStyle } from '../../modules/game/achievementColors'
import { achievementFromHistory } from '../../modules/game/achievementScoring'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseTable, { type TableColumn } from '../ui/BaseTable.vue'

const columns: TableColumn[] = [
  { key: 'score', width: '3.68rem', align: 'center' },
  { key: 'title', width: 'auto' },
  { key: 'importedAt', width: '10.0rem' },
  { key: 'lastPlayed', width: '10.0rem' },
  { key: 'duration', width: '6.0rem', align: 'center' },
  { key: 'playCount', width: '6.6rem', align: 'center' },
  { key: 'rating', width: '6.4rem', align: 'right' },
  { key: 'difficulty', width: '7.2rem', align: 'right' },
  { key: 'details', width: '3.32rem', align: 'center' },
]

defineProps<{ songs: SongMetadata[]; selectedId?: string | null }>()
const emit = defineEmits<{
  select: [song: SongMetadata]
  play: []
}>()

const { t } = useI18n()
const library = useLibraryStore()
const profiles = useProfileStore()
const settings = useSettingsStore()
const toastStore = useToastStore()
const MAX_LIBRARY_ACHIEVEMENT = 105
const editingSongId = ref<string | null>(null)
const editingTitle = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const songAchievementScores = computed(() => {
  const scores: Record<string, number> = {}
  const bestBySongModeHand: Record<string, number> = {}
  const bySongModeHandTrack: Record<string, typeof profiles.activeProfile.scoresByMode[keyof typeof profiles.activeProfile.scoresByMode]> = {}

  for (const entries of Object.values(profiles.activeProfile.scoresByMode)) {
    for (const entry of entries ?? []) {
      const key = `${entry.songId}:${entry.mode}:${entry.handSelection}:${entry.trackSelectionKey ?? 'legacy'}`
      bySongModeHandTrack[key] ??= []
      bySongModeHandTrack[key]!.push(entry)
    }
  }

  for (const entries of Object.values(bySongModeHandTrack)) {
    const achievement = achievementFromHistory(entries ?? [])
    const firstEntry = entries?.[0]
    if (!achievement || !firstEntry) continue
    const key = `${firstEntry.songId}:${firstEntry.mode}:${firstEntry.handSelection}`
    bestBySongModeHand[key] = Math.max(bestBySongModeHand[key] ?? 0, achievement.total)
  }

  for (const [key, score] of Object.entries(bestBySongModeHand)) {
    const [songId] = key.split(':')
    scores[songId] = Math.min(MAX_LIBRARY_ACHIEVEMENT, (scores[songId] ?? 0) + score)
  }

  return scores
})

function formatScore(value: number) {
  return String(Math.round(value))
}

function achievementScore(songId: string) {
  return Math.min(MAX_LIBRARY_ACHIEVEMENT, songAchievementScores.value[songId] ?? 0)
}

function songScoreStyle(songId: string) {
  return achievementColorStyle(achievementScore(songId), MAX_LIBRARY_ACHIEVEMENT)
}

// Detail popup state
const detailSong = ref<SongMetadata | null>(null)
const detailPopupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const detailArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px' })
const detailArrowPlacement = ref<'left' | 'right'>('left')

// Rating dialog state
const ratingDialogSong = ref<SongMetadata | null>(null)
const ratingPopupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const ratingArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px' })
const ratingArrowPlacement = ref<'left' | 'right'>('left')

// Difficulty dialog state
const difficultyDialogSong = ref<SongMetadata | null>(null)
const difficultyPopupStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const difficultyArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px' })
const difficultyArrowPlacement = ref<'left' | 'right'>('left')
const difficultyAutoRunningSongId = ref<string | null>(null)

function formatShortDate(value: number) {
  return formatDate(value, settings.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatLastPlayed(value: number) {
  if (!value) return t('common.never')
  return formatShortDate(value)
}

function formatImportedAt(value: number) {
  if (!value) return '—'
  return formatShortDate(value)
}

function formatImportedAtDetail(value: number) {
  if (!value) return '—'
  return formatDateTime(value, settings.locale)
}

function formatDuration(durationUs: number) {
  if (!Number.isFinite(durationUs) || durationUs <= 0) return '0:00'

  const totalSeconds = Math.round(durationUs / 1_000_000)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function isRenaming(song: SongMetadata) {
  return editingSongId.value === song.id
}

function setTitleInputRef(element: unknown) {
  if (!element) {
    titleInputRef.value = null
    return
  }
  if (element instanceof HTMLInputElement) {
    titleInputRef.value = element
  } else if (element && typeof element === 'object' && '$el' in element) {
    const el = (element as { $el: HTMLElement }).$el
    titleInputRef.value = el ? el.querySelector('input') : null
  }
}

function focusTitleInput() {
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

async function startRename(event: Event, song: SongMetadata) {
  event.stopPropagation()
  editingSongId.value = song.id
  editingTitle.value = song.title
  await nextTick()
  focusTitleInput()
}

function saveRename(event?: Event) {
  event?.stopPropagation()
  const id = editingSongId.value
  if (!id) return
  const saved = library.renameSong(id, editingTitle.value)
  if (!saved) {
    focusTitleInput()
    return
  }
  editingSongId.value = null
  editingTitle.value = ''
}

function cancelRename(event?: Event) {
  event?.stopPropagation()
  editingSongId.value = null
  editingTitle.value = ''
}

function handleRowClick(song: SongMetadata) {
  if (isRenaming(song)) return
  emit('select', song)
}

function handleRowDoubleClick(song: SongMetadata) {
  if (isRenaming(song)) return
  emit('play')
}

function handleRowKeydown(event: KeyboardEvent, song: SongMetadata) {
  if (isRenaming(song)) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('select', song)
}

function stars(value: number | undefined) {
  const count = Math.max(0, Math.min(5, value ?? 0))
  return '★★★★★'.slice(0, count).padEnd(5, '☆')
}

function calculatePopupPosition(element: HTMLElement, popupWidth: number, popupHeight: number) {
  const rect = element.getBoundingClientRect()
  const margin = 10
  const gap = 8

  // Default: position to the LEFT of element
  let left = rect.left - popupWidth - gap
  let top = rect.top
  let arrowOnRight = true

  // Check left boundary - if doesn't fit, position to RIGHT instead
  if (left < margin) {
    left = rect.right + gap
    arrowOnRight = false
  }

  // Check right boundary
  if (left + popupWidth > window.innerWidth - margin) {
    left = window.innerWidth - popupWidth - margin
  }

  // Check top boundary
  if (top < margin) {
    top = margin
  }

  // Check bottom boundary
  if (top + popupHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - popupHeight - margin)
  }

  // Calculate arrow position - point at center of element
  const arrowTop = rect.top + rect.height / 2 - top

  return {
    popupStyle: { top: `${top}px`, left: `${left}px` },
    arrowStyle: arrowOnRight
      ? { top: `${arrowTop}px`, right: '-7px' }
      : { top: `${arrowTop}px`, left: '-7px' },
    arrowPlacement: arrowOnRight ? 'right' as const : 'left' as const
  }
}

function showDetail(event: MouseEvent, song: SongMetadata) {
  event.stopPropagation()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 288, 370)

  detailPopupStyle.value = popupStyle
  detailArrowStyle.value = arrowStyle
  detailArrowPlacement.value = arrowPlacement
  detailSong.value = song
}

function closeDetail() {
  detailSong.value = null
}

function showRatingDialog(event: MouseEvent, song: SongMetadata) {
  event.stopPropagation()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 160, 80)

  ratingPopupStyle.value = popupStyle
  ratingArrowStyle.value = arrowStyle
  ratingArrowPlacement.value = arrowPlacement
  ratingDialogSong.value = song
}

function closeRatingDialog() {
  ratingDialogSong.value = null
}

function setRating(rating: number) {
  if (ratingDialogSong.value) {
    library.updateSongPreferences(ratingDialogSong.value.id, { rating })
    closeRatingDialog()
  }
}

function clearRating() {
  if (ratingDialogSong.value) {
    library.updateSongPreferences(ratingDialogSong.value.id, { rating: undefined })
    closeRatingDialog()
  }
}

function showDifficultyDialog(event: MouseEvent, song: SongMetadata) {
  event.stopPropagation()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 200, 120)

  difficultyPopupStyle.value = popupStyle
  difficultyArrowStyle.value = arrowStyle
  difficultyArrowPlacement.value = arrowPlacement
  difficultyDialogSong.value = song
}

function closeDifficultyDialog() {
  difficultyDialogSong.value = null
}

function setDifficulty(difficulty: number) {
  if (difficultyDialogSong.value) {
    library.updateSongPreferences(difficultyDialogSong.value.id, { difficulty })
    closeDifficultyDialog()
  }
}

async function autoDifficulty() {
  const song = difficultyDialogSong.value
  if (!song || difficultyAutoRunningSongId.value) return
  difficultyAutoRunningSongId.value = song.id
  toastStore.showLoading(t('library.autoDifficultyProgress'))

  try {
    await library.evaluateSongDifficulty(song.id)
    toastStore.showSuccess(t('library.autoDifficultySingleSuccess', { title: song.title }))
    closeDifficultyDialog()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toastStore.showError(t('library.autoDifficultyFailed', { title: song.title, message }))
  } finally {
    difficultyAutoRunningSongId.value = null
  }
}

function clearDifficulty() {
  if (difficultyDialogSong.value) {
    library.updateSongPreferences(difficultyDialogSong.value.id, { difficulty: undefined })
    closeDifficultyDialog()
  }
}

</script>

<template>
  <div v-if="songs.length" class="song-list">
    <BaseTable
      :data="songs"
      :columns="columns"
      row-key="id"
      :selected-key="selectedId"
      hide-header
      @row-click="handleRowClick"
      @row-dblclick="handleRowDoubleClick"
      @row-keydown="handleRowKeydown"
    >
      <template #cell-score="{ item: song }">
        <span class="song-score" :style="songScoreStyle(song.id)">{{ formatScore(achievementScore(song.id)) }}</span>
      </template>

      <template #cell-title="{ item: song }">
        <span class="song-title-cell">
          <template v-if="isRenaming(song)">
            <span class="song-title-input">
              <BaseInput
                :ref="setTitleInputRef"
                v-model="editingTitle"
                @keydown.enter.stop="saveRename"
                @keydown.escape.stop="cancelRename"
                @click.stop
                @dblclick.stop
                @blur="cancelRename"
              />
            </span>
            <BaseButton
              variant="text"
              size="sm"
              class="rename-button rename-confirm-button"
              :disabled="!editingTitle.trim()"
              :title="t('common.save')"
              @mousedown.prevent
              @click.stop="saveRename"
              @dblclick.stop
            >
              <i class="fa-solid fa-check" aria-hidden="true" />
            </BaseButton>
            <BaseButton
              variant="text"
              size="sm"
              class="rename-button rename-cancel-button"
              :title="t('common.cancel')"
              @mousedown.prevent
              @click.stop="cancelRename"
              @dblclick.stop
            >
              <i class="fa-solid fa-xmark" aria-hidden="true" />
            </BaseButton>
          </template>
          <template v-else>
            <span class="song-title-text">{{ song.title }}</span>
            <BaseButton
              variant="text"
              size="sm"
              class="rename-button"
              :title="t('library.renameSong')"
              @mousedown.prevent
              @click="startRename($event, song)"
              @dblclick.stop
            >
              <i class="fa-solid fa-pencil" aria-hidden="true" />
            </BaseButton>
          </template>
        </span>
      </template>

      <template #cell-importedAt="{ item: song }">
        <span class="song-imported-at muted">{{ formatImportedAt(song.importedAt) }}</span>
      </template>

      <template #cell-lastPlayed="{ item: song }">
        <span class="song-last-played muted">{{ formatLastPlayed(song.lastPlayed) }}</span>
      </template>

      <template #cell-duration="{ item: song }">
        <span class="song-duration muted">{{ formatDuration(song.duration) }}</span>
      </template>

      <template #cell-playCount="{ item: song }">
        <span class="song-play-count">{{ song.playCount }}</span>
      </template>

      <template #cell-rating="{ item: song }">
        <div
          class="song-rating"
          :class="{ 'has-rating': song.rating }"
          :aria-label="t('library.ratingValue', { value: song.rating ?? 0 })"
          @click="showRatingDialog($event, song)"
        >
          {{ stars(song.rating) }}
        </div>
      </template>

      <template #cell-difficulty="{ item: song }">
        <div
          class="song-difficulty"
          :aria-label="t('library.difficultyValue', { value: song.difficulty ?? 0 })"
          @click="showDifficultyDialog($event, song)"
        >
          <span
            v-for="value in 10"
            :key="value"
            class="difficulty-bar"
            :class="{ filled: value <= (song.difficulty ?? 0) }"
            :data-level="value"
          />
        </div>
      </template>

      <template #cell-details="{ item: song }">
        <div
          class="detail-button"
          @click="showDetail($event, song)"
          :aria-label="t('library.showDetails')"
        >
          <i class="fa fa-info"></i>
        </div>
      </template>
    </BaseTable>
  </div>
  <p v-else class="muted empty-list">{{ t('library.importToStart') }}</p>

  <!-- Detail Popup -->
  <Teleport to="body">
    <div v-if="detailSong" class="detail-overlay" @click="closeDetail">
      <div class="detail-popup" :style="detailPopupStyle" @click.stop>
        <div class="detail-arrow" :class="`arrow-${detailArrowPlacement}`" :style="detailArrowStyle" />
        <div class="detail-content">
          <h4 class="detail-dialog-title">{{ detailSong.title }}</h4>
          <div class="detail-info">
            <div class="detail-row">
              <span class="detail-label">{{ t('library.duration') }}:</span>
              <span class="detail-value">{{ formatDuration(detailSong.duration) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.tracks') }}:</span>
              <span class="detail-value">{{ detailSong.trackCount }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.notes') }}:</span>
              <span class="detail-value">{{ detailSong.noteCount }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.achievement') }}:</span>
              <span class="detail-value">{{ formatScore(achievementScore(detailSong.id)) }}/105</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.playCount') }}:</span>
              <span class="detail-value">{{ detailSong.playCount }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.importedAt') }}:</span>
              <span class="detail-value">{{ formatImportedAtDetail(detailSong.importedAt) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.lastPlayed') }}:</span>
              <span class="detail-value">{{ formatLastPlayed(detailSong.lastPlayed) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.rating') }}:</span>
              <span class="detail-value">{{ stars(detailSong.rating) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('library.difficulty') }}:</span>
              <span class="detail-value">{{ detailSong.difficulty ?? 0 }}/10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Rating Dialog -->
  <Teleport to="body">
    <div v-if="ratingDialogSong" class="dialog-overlay" @click="closeRatingDialog">
      <div class="quick-dialog" :style="ratingPopupStyle" @click.stop>
        <div class="dialog-arrow" :class="`arrow-${ratingArrowPlacement}`" :style="ratingArrowStyle" />
        <div class="dialog-content">
          <h4 class="dialog-title">{{ t('library.rating') }}</h4>
          <div class="dialog-stars">
            <button
              v-for="value in 5"
              :key="value"
              type="button"
              class="star-button"
              :class="{ active: value <= (ratingDialogSong.rating ?? 0) }"
              @click="setRating(value)"
            >
              ★
            </button>
          </div>
          <button type="button" class="clear-button" @click="clearRating">{{ t('common.clear') }}</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Difficulty Dialog -->
  <Teleport to="body">
    <div v-if="difficultyDialogSong" class="dialog-overlay" @click="closeDifficultyDialog">
      <div class="quick-dialog" :style="difficultyPopupStyle" @click.stop>
        <div class="dialog-arrow" :class="`arrow-${difficultyArrowPlacement}`" :style="difficultyArrowStyle" />
        <div class="dialog-content">
          <h4 class="dialog-title">{{ t('library.difficulty') }}</h4>
          <div class="dialog-bars">
            <button
              v-for="value in 10"
              :key="value"
              type="button"
              class="bar-button"
              :class="{ active: value <= (difficultyDialogSong.difficulty ?? 0) }"
              :data-level="value"
              @click="setDifficulty(value)"
            >
              <span class="bar-fill" />
            </button>
          </div>
          <div class="dialog-actions">
            <button
              type="button"
              class="auto-button"
              :disabled="difficultyAutoRunningSongId === difficultyDialogSong.id"
              @click="autoDifficulty"
            >
              <i v-if="difficultyAutoRunningSongId === difficultyDialogSong.id" class="fa-solid fa-spinner fa-spin" aria-hidden="true" />
              <span>{{ t('library.autoDifficulty') }}</span>
            </button>
            <button type="button" class="clear-button" :disabled="difficultyAutoRunningSongId === difficultyDialogSong.id" @click="clearDifficulty">{{ t('common.clear') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.song-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  background: var(--color-bg-secondary);
}

:deep(.base-table) {
  table-layout: fixed;
}

:deep(.base-table-row) {
  height: 2.52rem;
}

:deep(.base-table td) {
  padding: 0.08rem 0.8rem 0.08rem 0;
}

:deep(.base-table td:first-child) {
  padding-left: 0.18rem;
}

:deep(.base-table td:last-child) {
  padding-right: 0.82rem;
}

.song-score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  width: 1.72rem;
  height: 1.92rem;
  border: 1px solid var(--achievement-border, rgba(255, 255, 255, 0.12));
  border-radius: 0;
  background: var(--achievement-bg, rgba(45, 45, 45, 0.65));
  color: var(--achievement-color, rgba(255, 255, 255, 0.38));
  font-size: 0.94rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.song-title-cell,
.song-imported-at,
.song-last-played,
.song-duration {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-title-cell {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.95rem;
}

.song-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-title-input {
  flex: 1 1 0%;
  min-width: 0;
  display: flex;
}

.song-title-input :deep(.base-input) {
  flex: 1 1 0%;
  min-width: 0;
}

.song-title-input :deep(.base-input-field) {
  width: 100%;
  height: 32px;
  padding: 0 0.6rem;
  font-size: 0.92rem;
  font-weight: 500;
  border-radius: 4px;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-strong);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.song-title-input :deep(.base-input-field:focus) {
  background: var(--color-bg-input-focus);
  border-color: var(--color-accent-blue);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-blue) 30%, transparent), inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

.rename-button {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  transition: all 0.15s ease;
}

.rename-button:hover:not(:disabled) {
  color: var(--color-text-primary);
  transform: scale(1.08);
}

.rename-confirm-button {
  color: #4ade80 !important;
}

.rename-cancel-button {
  color: #f87171 !important;
}

:deep(.base-table-row.is-selected) .rename-button {
  color: var(--color-row-selected-text);
  opacity: 0.8;
}

:deep(.base-table-row.is-selected) .rename-confirm-button {
  color: #4ade80 !important;
  opacity: 1;
}

:deep(.base-table-row.is-selected) .rename-cancel-button {
  color: #f87171 !important;
  opacity: 1;
}

.song-imported-at,
.song-last-played,
.song-duration {
  color: var(--color-text-muted);
  font-size: 0.84rem;
}

.song-duration {
  justify-self: center;
  font-variant-numeric: tabular-nums;
}

:deep(.base-table-row.is-selected) .song-imported-at,
:deep(.base-table-row.is-selected) .song-last-played,
:deep(.base-table-row.is-selected) .song-duration {
  color: var(--color-row-selected-text);
  opacity: 0.7;
}

.song-play-count {
  justify-self: center;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.song-rating {
  justify-self: end;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  letter-spacing: 0.03em;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.song-rating:hover {
  color: var(--color-text-secondary);
  transform: scale(1.05);
}

.song-rating.has-rating {
  color: #fbbf24;
  text-shadow: 0 0 2px rgba(251, 191, 36, 0.3);
}

.song-rating.has-rating:hover {
  color: #fcd34d;
  text-shadow: 0 0 3px rgba(252, 211, 77, 0.4);
}

:deep(.base-table-row.is-selected) .song-rating {
  color: var(--color-row-selected-text);
  opacity: 0.6;
}

:deep(.base-table-row.is-selected) .song-rating.has-rating {
  color: #fbbf24;
  opacity: 1;
  text-shadow: 0 0 3px rgba(251, 191, 36, 0.4);
}

.song-difficulty {
  display: flex;
  align-items: end;
  justify-self: end;
  gap: 0.13rem;
  height: 0.9rem;
  padding: 0;
  border: 0;
  background: transparent;
  opacity: 0.5;
  cursor: pointer;
  transition: all 0.15s ease;
}

.song-difficulty:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

:deep(.base-table-row.is-selected) .song-difficulty {
  opacity: 0.74;
}

:deep(.base-table-row.is-selected) .song-difficulty:hover {
  opacity: 0.9;
}

.difficulty-bar {
  width: 0.24rem;
  border-radius: 0;
  background: var(--color-bg-subtle);
}

.difficulty-bar:nth-child(1) { height: 20%; }
.difficulty-bar:nth-child(2) { height: 30%; }
.difficulty-bar:nth-child(3) { height: 40%; }
.difficulty-bar:nth-child(4) { height: 50%; }
.difficulty-bar:nth-child(5) { height: 60%; }
.difficulty-bar:nth-child(6) { height: 70%; }
.difficulty-bar:nth-child(7) { height: 78%; }
.difficulty-bar:nth-child(8) { height: 85%; }
.difficulty-bar:nth-child(9) { height: 92%; }
.difficulty-bar:nth-child(10) { height: 98%; }

.difficulty-bar.filled {
  background: var(--color-text-secondary);
}

.difficulty-bar.filled[data-level="1"] { background: #22c55e; }
.difficulty-bar.filled[data-level="2"] { background: #65d663; }
.difficulty-bar.filled[data-level="3"] { background: #a3e635; }
.difficulty-bar.filled[data-level="4"] { background: #eab308; }
.difficulty-bar.filled[data-level="5"] { background: #fbbf24; }
.difficulty-bar.filled[data-level="6"] { background: #ffa500; }
.difficulty-bar.filled[data-level="7"] { background: #ff8c00; }
.difficulty-bar.filled[data-level="8"] { background: #ff6347; }
.difficulty-bar.filled[data-level="9"] { background: #ef4444; }
.difficulty-bar.filled[data-level="10"] { background: #dc2626; }

.empty-list {
  margin: 0;
}

/* Detail button styles */
.detail-button {
  display: grid;
  place-items: center;
  justify-self: center;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.detail-button i {
  display: block;
  line-height: 1;
}

.detail-button:hover {
  background: var(--color-bg-card-hover);
  color: var(--color-text-primary);
  transform: scale(1.1);
}

.song-row.selected .detail-button {
  background: var(--color-bg-card-hover);
  color: var(--color-text-primary);
}

/* Detail popup styles */
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--color-bg-overlay);
}

.detail-popup {
  position: fixed;
  z-index: 1001;
  width: 18rem;
  border-radius: 0.5rem;
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-default);
  overflow: visible;
}

.detail-arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  transform: translateY(-50%) rotate(45deg);
  background: var(--color-bg-elevated);
  z-index: -1;
}

.detail-arrow.arrow-right {
  right: -7px;
  border-top: 1px solid var(--color-border-default);
  border-right: 1px solid var(--color-border-default);
}

.detail-arrow.arrow-left {
  left: -7px;
  border-bottom: 1px solid var(--color-border-default);
  border-left: 1px solid var(--color-border-default);
}

.detail-content {
  position: relative;
  padding: 5px;
  border-radius: 0.5rem;
  overflow: hidden;
}

.detail-dialog-title {
  margin: 0 0 5px 0;
  padding: 0 4px 3px;
  color: var(--color-text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 10px;
  border-radius: 0.35rem;
  background: var(--color-bg-subtle);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.88rem;
}

.detail-label {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.detail-value {
  color: var(--color-text-primary);
  font-weight: 400;
  text-align: right;
}

/* Quick dialog styles */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--color-bg-overlay);
}

.quick-dialog {
  position: fixed;
  z-index: 1001;
  border-radius: 0.5rem;
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-default);
  overflow: visible;
}

.dialog-arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  transform: translateY(-50%) rotate(45deg);
  background: var(--color-bg-elevated);
  z-index: -1;
}

.dialog-arrow.arrow-right {
  right: -7px;
  border-top: 1px solid var(--color-border-default);
  border-right: 1px solid var(--color-border-default);
}

.dialog-arrow.arrow-left {
  left: -7px;
  border-bottom: 1px solid var(--color-border-default);
  border-left: 1px solid var(--color-border-default);
}

.dialog-content {
  position: relative;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.dialog-title {
  margin: 0;
  padding: 0 0 3px 0;
  color: var(--color-text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid var(--color-border-subtle);
}

.dialog-stars {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.star-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
}

.star-button:hover {
  color: var(--color-text-secondary);
  transform: scale(1.15);
}

.star-button.active {
  color: #fbbf24;
  text-shadow: 0 0 4px rgba(251, 191, 36, 0.5);
}

.star-button.active:hover {
  color: #fcd34d;
  text-shadow: 0 0 6px rgba(252, 211, 77, 0.6);
}

.dialog-bars {
  display: flex;
  gap: 3px;
  justify-content: center;
  align-items: end;
  height: 60px;
  padding: 5px 0;
}

.bar-button {
  padding: 0;
  border: 0;
  background: transparent;
  width: 14px;
  height: 100%;
  display: flex;
  align-items: end;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bar-button:hover {
  transform: scaleY(1.05);
}

.bar-button .bar-fill {
  width: 100%;
  background: var(--color-text-muted);
  border-radius: 2px;
  transition: all 0.15s ease;
}

.bar-button:nth-child(1) .bar-fill { height: 20%; }
.bar-button:nth-child(2) .bar-fill { height: 30%; }
.bar-button:nth-child(3) .bar-fill { height: 40%; }
.bar-button:nth-child(4) .bar-fill { height: 50%; }
.bar-button:nth-child(5) .bar-fill { height: 60%; }
.bar-button:nth-child(6) .bar-fill { height: 70%; }
.bar-button:nth-child(7) .bar-fill { height: 78%; }
.bar-button:nth-child(8) .bar-fill { height: 85%; }
.bar-button:nth-child(9) .bar-fill { height: 92%; }
.bar-button:nth-child(10) .bar-fill { height: 98%; }

.bar-button.active:nth-child(1) .bar-fill { background: #22c55e; }
.bar-button.active:nth-child(2) .bar-fill { background: #65d663; }
.bar-button.active:nth-child(3) .bar-fill { background: #a3e635; }
.bar-button.active:nth-child(4) .bar-fill { background: #eab308; }
.bar-button.active:nth-child(5) .bar-fill { background: #fbbf24; }
.bar-button.active:nth-child(6) .bar-fill { background: #ffa500; }
.bar-button.active:nth-child(7) .bar-fill { background: #ff8c00; }
.bar-button.active:nth-child(8) .bar-fill { background: #ff6347; }
.bar-button.active:nth-child(9) .bar-fill { background: #ef4444; }
.bar-button.active:nth-child(10) .bar-fill { background: #dc2626; }

.dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.auto-button,
.clear-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 26px;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.auto-button {
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
}

.auto-button:hover:not(:disabled) {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.clear-button {
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-subtle);
  color: var(--color-accent-red);
}

.clear-button:hover:not(:disabled) {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-strong);
  color: var(--color-accent-red);
}

.auto-button:disabled,
.clear-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

@media (max-width: 1100px) {
  .song-row {
    grid-template-columns: 2.5rem minmax(0, 1fr) 8rem 8rem 4.6rem 5rem 4.9rem 5.8rem 2.3rem;
    gap: 0.52rem;
    padding-inline: 0.16rem 0.56rem;
  }

  .detail-button {
    width: 1.6rem;
    height: 1.6rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 760px) {
  .song-row {
    grid-template-columns: 2.2rem minmax(0, 1fr) 5.4rem 3.8rem 3.8rem 5rem 2rem;
    gap: 0.42rem;
    font-size: 0.82rem;
  }

  .song-last-played {
    display: none;
  }

  .song-duration,
  .song-rating {
    font-size: 0.78rem;
  }

  .detail-button {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.85rem;
  }

  .difficulty-bar {
    width: 0.2rem;
  }
}
</style>

