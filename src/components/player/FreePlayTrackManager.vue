<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirmDialog } from '../../composables/useConfirmDialog'
import { getEmojiFontFamily, getInstrumentByProgram, getInstrumentEmoji } from '../../modules/audio/gmInstrumentCatalog'
import { MAX_FREE_PLAY_TRACKS, useFreePlayStore, type FreePlayTrack } from '../../stores/freePlayStore'
import TrackInstrumentDialog from './dialogs/TrackInstrumentDialog.vue'
import ColorPickerDialog from './dialogs/ColorPickerDialog.vue'

const { t } = useI18n()
const { confirm } = useConfirmDialog()
const freePlay = useFreePlayStore()

const showInstrumentDialog = ref(false)
const showColorDialog = ref(false)
const editingTrackId = ref<number | null>(null)
const popupStyle = ref({ top: '0px', left: '0px' })
const arrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', left: '-7px' })
const arrowPlacement = ref<'left' | 'right'>('left')

const editingTrack = computed(() => freePlay.tracks.find(track => track.id === editingTrackId.value) ?? freePlay.selectedTrack)

function instrument(track: FreePlayTrack) {
  return getInstrumentByProgram(track.instrumentProgram)
}

function trackName(track: FreePlayTrack, index: number) {
  return t('freePlay.trackNumber', { number: index + 1, instrument: instrument(track).name })
}

function calculatePopupPosition(element: HTMLElement, width: number, height: number) {
  const rect = element.getBoundingClientRect()
  const margin = 10
  const gap = 10
  let left = rect.right + gap
  let top = rect.top + rect.height / 2 - height / 2
  let placement: 'left' | 'right' = 'left'

  if (left + width > window.innerWidth - margin) {
    left = rect.left - width - gap
    placement = 'right'
  }
  if (left < margin) left = margin
  if (top < margin) top = margin
  if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - height - margin)

  const arrowTop = rect.top + rect.height / 2 - top
  return {
    popupStyle: { top: `${top}px`, left: `${left}px` },
    arrowStyle: placement === 'left' ? { top: `${arrowTop}px`, left: '-7px' } : { top: `${arrowTop}px`, right: '-7px' },
    arrowPlacement: placement,
  }
}

function openInstrument(track: FreePlayTrack, event: MouseEvent) {
  event.stopPropagation()
  freePlay.selectTrack(track.id)
  editingTrackId.value = track.id
  const position = calculatePopupPosition(event.currentTarget as HTMLElement, 500, 520)
  popupStyle.value = position.popupStyle
  arrowStyle.value = position.arrowStyle
  arrowPlacement.value = position.arrowPlacement
  showColorDialog.value = false
  showInstrumentDialog.value = true
}

function openColor(track: FreePlayTrack, event: MouseEvent) {
  event.stopPropagation()
  freePlay.selectTrack(track.id)
  editingTrackId.value = track.id
  const position = calculatePopupPosition(event.currentTarget as HTMLElement, 80, 360)
  popupStyle.value = position.popupStyle
  arrowStyle.value = position.arrowStyle
  arrowPlacement.value = position.arrowPlacement
  showInstrumentDialog.value = false
  showColorDialog.value = true
}

function selectInstrument(program: number) {
  if (editingTrackId.value == null) return
  freePlay.setTrackInstrument(editingTrackId.value, program)
}

function selectColor(color: string) {
  if (editingTrackId.value == null) return
  freePlay.setTrackColor(editingTrackId.value, color)
}

async function deleteTrack(track: FreePlayTrack, event: MouseEvent) {
  event.stopPropagation()
  freePlay.selectTrack(track.id)
  const confirmed = await confirm({
    title: t('freePlay.deleteTrackConfirmTitle'),
    message: t('freePlay.deleteTrackConfirmMessage', { track: trackName(track, freePlay.tracks.findIndex(item => item.id === track.id)) }),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
  if (confirmed) freePlay.deleteTrack(track.id)
}

async function clearTrack(track: FreePlayTrack, event: MouseEvent) {
  event.stopPropagation()
  freePlay.selectTrack(track.id)
  const confirmed = await confirm({
    title: t('freePlay.clearTrackConfirmTitle'),
    message: t('freePlay.clearTrackConfirmMessage', { track: trackName(track, freePlay.tracks.findIndex(item => item.id === track.id)) }),
    confirmLabel: t('common.clear'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
  if (confirmed) freePlay.clearTrack(track.id)
}

function toggleLoop(track: FreePlayTrack, event: MouseEvent) {
  event.stopPropagation()
  freePlay.selectTrack(track.id)
  freePlay.toggleTrackLoop(track.id)
}
</script>

<template>
  <aside class="free-play-track-manager" :aria-label="t('freePlay.trackManager')">
    <div class="track-list">
      <div
        v-for="(track, index) in freePlay.tracks"
        :key="track.id"
        class="track-row"
        :class="{ selected: track.id === freePlay.selectedTrackId }"
        :title="trackName(track, index)"
        :aria-label="t('freePlay.selectTrack', { track: trackName(track, index) })"
        role="button"
        tabindex="0"
        @click="freePlay.selectTrack(track.id)"
        @keydown.enter="freePlay.selectTrack(track.id)"
        @keydown.space.prevent="freePlay.selectTrack(track.id)"
      >
        <div class="track-item">
          <button
            class="track-tool instrument-button"
            :title="t('freePlay.selectTrackInstrument')"
            :aria-label="t('freePlay.selectTrackInstrument')"
            @click="openInstrument(track, $event)"
          >
            <span class="instrument-emoji">{{ getInstrumentEmoji(instrument(track)) }}</span>
          </button>
          <button
            class="track-tool color-button"
            :style="{ backgroundColor: track.color }"
            :title="t('freePlay.selectTrackColor')"
            :aria-label="t('freePlay.selectTrackColor')"
            @click="openColor(track, $event)"
          ></button>
        </div>
        <span class="track-actions">
          <button
            class="action-button loop-button"
            :class="{ active: track.loop }"
            :title="track.loop ? t('freePlay.loopTrackEnabled') : t('freePlay.loopTrackDisabled')"
            :aria-label="t('freePlay.loopTrack')"
            @click="toggleLoop(track, $event)"
          >
            <i class="fas fa-repeat"></i>
          </button>
          <button
            class="action-button clear-button"
            :title="t('freePlay.clearTrack')"
            :aria-label="t('freePlay.clearTrack')"
            @click="clearTrack(track, $event)"
          >
            <i class="fas fa-eraser"></i>
          </button>
          <button
            class="action-button delete-button"
            :title="t('freePlay.deleteTrack')"
            :aria-label="t('freePlay.deleteTrack')"
            @click="deleteTrack(track, $event)"
          >
            <i class="fas fa-trash-alt"></i>
          </button>
        </span>
      </div>
    </div>

    <button
      class="add-track-button"
      :disabled="!freePlay.canAddTrack"
      :title="freePlay.canAddTrack ? t('freePlay.addTrack') : t('freePlay.addTrackLimitReached', { count: MAX_FREE_PLAY_TRACKS })"
      :aria-label="freePlay.canAddTrack ? t('freePlay.addTrack') : t('freePlay.addTrackLimitReached', { count: MAX_FREE_PLAY_TRACKS })"
      @click="freePlay.addTrack()"
    >
      <i class="fas fa-plus"></i>
    </button>

    <TrackInstrumentDialog
      :show="showInstrumentDialog"
      :current-program="editingTrack.instrumentProgram"
      :popup-style="popupStyle"
      :arrow-style="arrowStyle"
      :arrow-placement="arrowPlacement"
      @select="selectInstrument"
      @close="showInstrumentDialog = false"
    />

    <ColorPickerDialog
      :show="showColorDialog"
      :current-color="editingTrack.color"
      :popup-style="popupStyle"
      :arrow-style="arrowStyle"
      :arrow-placement="arrowPlacement"
      @select="selectColor"
      @close="showColorDialog = false"
    />
  </aside>
</template>

<style scoped>
.free-play-track-manager {
  position: absolute;
  top: 0.75rem;
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-start;
}

.track-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-start;
}

.track-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0;
  color: #e3e4e8;
  cursor: pointer;
}

.track-item {
  width: 118px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  border: 3px solid transparent;
  border-radius: 4px;
  background: rgba(116, 116, 116, 0.86);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.track-row:hover .track-item,
.track-row:focus-within .track-item,
.track-row.selected .track-item {
  background: rgba(128, 128, 128, 0.92);
}

.track-row.selected .track-item {
  border-color: rgba(255, 255, 255, 0.95);
}

.track-tool,
.action-button,
.add-track-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  color: #e5e7eb;
  cursor: pointer;
  transition: filter 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
}

.track-tool:hover,
.action-button:hover,
.add-track-button:hover:not(:disabled) {
  filter: brightness(1.08);
}

.instrument-button {
  width: 44px;
  height: 44px;
  background: transparent;
}

.instrument-emoji {
  font-family: v-bind('getEmojiFontFamily()');
  font-size: 2rem;
  line-height: 1;
  filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.45));
}

.color-button {
  width: 28px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.94);
  border-radius: 0;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.track-actions {
  position: absolute;
  left: calc(100% + 0.35rem);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.22rem;
  opacity: 0;
  pointer-events: none;
}

.track-row:hover .track-actions,
.track-row:focus-within .track-actions,
.track-row.selected .track-actions {
  opacity: 1;
  pointer-events: auto;
}

.action-button {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgba(32, 34, 38, 0.82);
  font-size: 0.72rem;
}

.loop-button.active {
  color: #fbbf24;
}

.clear-button {
  color: #fde68a;
}

.delete-button {
  color: #fecaca;
}

.add-track-button {
  width: 118px;
  height: 32px;
  border-radius: 4px;
  border: 2px dashed rgba(255, 255, 255, 0.36);
  background: rgba(116, 116, 116, 0.52);
}

.add-track-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
