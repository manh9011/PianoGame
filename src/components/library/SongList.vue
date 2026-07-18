<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SongMetadata } from '../../types/song'
import { useLibraryStore } from '../../stores/libraryStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { formatDate } from '../../i18n/formatters'
import { achievementColorStyle } from '../../modules/game/achievementColors'
import { achievementFromHistory } from '../../modules/game/achievementScoring'

defineProps<{ songs: SongMetadata[]; selectedId?: string | null }>()
defineEmits<{
  select: [song: SongMetadata]
  play: []
}>()

const { t } = useI18n()
const library = useLibraryStore()
const profiles = useProfileStore()
const settings = useSettingsStore()
const MAX_LIBRARY_ACHIEVEMENT = 105

const songAchievementScores = computed(() => {
  const scores: Record<string, number> = {}
  const bySongModeHand: Record<string, typeof profiles.activeProfile.scoresByMode[keyof typeof profiles.activeProfile.scoresByMode]> = {}

  for (const entries of Object.values(profiles.activeProfile.scoresByMode)) {
    for (const entry of entries ?? []) {
      const key = `${entry.songId}:${entry.mode}:${entry.handSelection}`
      bySongModeHand[key] ??= []
      bySongModeHand[key]!.push(entry)
    }
  }

  for (const entries of Object.values(bySongModeHand)) {
    const achievement = achievementFromHistory(entries ?? [])
    const songId = entries?.[0]?.songId
    if (!achievement || !songId) continue
    scores[songId] = Math.min(MAX_LIBRARY_ACHIEVEMENT, (scores[songId] ?? 0) + achievement.total)
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

function formatLastPlayed(value: number) {
  if (!value) return t('common.never')
  return formatDate(value, settings.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 288, 350)

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

function clearDifficulty() {
  if (difficultyDialogSong.value) {
    library.updateSongPreferences(difficultyDialogSong.value.id, { difficulty: undefined })
    closeDifficultyDialog()
  }
}

</script>

<template>
  <div v-if="songs.length" class="song-list">
    <button
      v-for="song in songs"
      :key="song.id"
      type="button"
      class="song-row"
      :class="{ selected: song.id === selectedId }"
      @click="$emit('select', song)"
      @dblclick="$emit('play')"
    >
      <span class="song-score" :style="songScoreStyle(song.id)">{{ formatScore(achievementScore(song.id)) }}</span>
      <span class="song-title">{{ song.title }}</span>
      <span class="song-last-played muted">{{ formatLastPlayed(song.lastPlayed) }}</span>
      <span class="song-duration muted">{{ formatDuration(song.duration) }}</span>
      <span class="song-play-count">{{ song.playCount }}</span>
      <div
        class="song-rating"
        :class="{ 'has-rating': song.rating }"
        :aria-label="t('library.ratingValue', { value: song.rating ?? 0 })"
        @click="showRatingDialog($event, song)"
      >
        {{ stars(song.rating) }}
      </div>
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
      <div
        class="detail-button"
        @click="showDetail($event, song)"
        :aria-label="t('library.showDetails')"
      >
        <i class="fa fa-info"></i>
      </div>
    </button>
  </div>
  <p v-else class="muted empty-list">{{ t('library.importToStart') }}</p>

  <!-- Detail Popup -->
  <Teleport to="body">
    <div v-if="detailSong" class="detail-overlay" @click="closeDetail">
      <div class="detail-popup" :style="detailPopupStyle" @click.stop>
        <div class="detail-arrow" :class="`arrow-${detailArrowPlacement}`" :style="detailArrowStyle" />
        <div class="detail-content">
          <h4 class="detail-dialog-title">{{ t('library.detail') }}</h4>
          <div class="detail-info">
            <h3 class="detail-title">{{ detailSong.title }}</h3>
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
          <button type="button" class="clear-button" @click="clearDifficulty">{{ t('common.clear') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.song-list {
  display: grid;
  gap: 0;
  min-height: 0;
  padding: 0;
  background: #454545;
}

.song-row {
  display: grid;
  grid-template-columns: 2.7rem minmax(0, 1fr) 10rem 5.5rem 6.4rem 5.9rem 6.8rem 2.5rem;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  min-height: 2.52rem;
  padding: 0.08rem 0.82rem 0.08rem 0.18rem;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.84);
  text-align: left;
  cursor: pointer;
}

.song-row:last-child {
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}

.song-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.song-row.selected {
  background: rgba(184, 184, 184, 0.62);
  color: #ffffff;
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

.song-title,
.song-last-played,
.song-duration {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-title {
  font-size: 0.95rem;
}

.song-last-played,
.song-duration {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.84rem;
}

.song-duration {
  justify-self: center;
  font-variant-numeric: tabular-nums;
}

.song-row.selected .song-last-played,
.song-row.selected .song-duration {
  color: rgba(255, 255, 255, 0.82);
}

.song-play-count {
  justify-self: center;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
}

.song-rating {
  justify-self: end;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(28, 28, 28, 0.62);
  letter-spacing: 0.03em;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.song-rating:hover {
  color: rgba(28, 28, 28, 0.8);
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

.song-row.selected .song-rating {
  color: rgba(36, 36, 36, 0.74);
}

.song-row.selected .song-rating.has-rating {
  color: #fcd34d;
  text-shadow: 0 0 3px rgba(252, 211, 77, 0.4);
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

.song-row.selected .song-difficulty {
  opacity: 0.74;
}

.song-row.selected .song-difficulty:hover {
  opacity: 0.9;
}

.difficulty-bar {
  width: 0.24rem;
  border-radius: 0;
  background: rgba(24, 24, 24, 0.28);
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
  background: rgba(226, 226, 226, 0.68);
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
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
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
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1.1);
}

.song-row.selected .detail-button {
  background: rgba(255, 255, 255, 0.22);
  color: rgba(255, 255, 255, 0.85);
}

/* Detail popup styles */
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
}

.detail-popup {
  position: fixed;
  z-index: 1001;
  width: 18rem;
  border-radius: 0.5rem;
  background: linear-gradient(145deg, #4a4a4a, #3e3e3e);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.2),
    inset -1px -1px 2px rgba(0, 0, 0, 0.4),
    0 8px 16px rgba(0, 0, 0, 0.5),
    0 2px 4px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: visible;
}

.detail-arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  transform: translateY(-50%) rotate(45deg);
  background: linear-gradient(135deg, #4a4a4a, #3e3e3e);
  z-index: -1;
}

.detail-arrow.arrow-right {
  right: -7px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-arrow.arrow-left {
  left: -7px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-content {
  position: relative;
  padding: 5px;
  border-radius: 0.5rem;
  overflow: hidden;
}

.detail-dialog-title {
  margin: 0 0 5px 0;
  padding: 0 0 3px 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-title {
  margin: 0 0 8px 0;
  padding-bottom: 8px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 0.95rem;
  font-weight: 600;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 10px;
  border-radius: 0.35rem;
  background: rgba(0, 0, 0, 0.25);
  box-shadow:
    inset 2px 2px 4px rgba(0, 0, 0, 0.5),
    inset -1px -1px 2px rgba(255, 255, 255, 0.08);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.88rem;
}

.detail-label {
  color: rgba(255, 255, 255, 0.65);
  font-weight: 500;
}

.detail-value {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 400;
  text-align: right;
}

/* Quick dialog styles */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
}

.quick-dialog {
  position: fixed;
  z-index: 1001;
  border-radius: 0.5rem;
  background: linear-gradient(145deg, #4a4a4a, #3e3e3e);
  box-shadow:
    inset 1px 1px 2px rgba(255, 255, 255, 0.2),
    inset -1px -1px 2px rgba(0, 0, 0, 0.4),
    0 8px 16px rgba(0, 0, 0, 0.5),
    0 2px 4px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: visible;
}

.dialog-arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  transform: translateY(-50%) rotate(45deg);
  background: linear-gradient(135deg, #4a4a4a, #3e3e3e);
  z-index: -1;
}

.dialog-arrow.arrow-right {
  right: -7px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-arrow.arrow-left {
  left: -7px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.3);
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
}

.star-button:hover {
  color: rgba(255, 255, 255, 0.5);
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
  background: rgba(255, 255, 255, 0.3);
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

.clear-button {
  padding: 4px 8px;
  border: 1px solid rgba(255, 100, 100, 0.4);
  border-radius: 3px;
  background: rgba(200, 0, 0, 0.3);
  color: rgba(255, 150, 150, 0.9);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-button:hover {
  background: rgba(220, 0, 0, 0.5);
  border-color: rgba(255, 100, 100, 0.6);
  color: rgba(255, 200, 200, 1);
}

</style>
