<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFreePlayStore } from '../../stores/freePlayStore'
import { useSettingsStore } from '../../stores/settingsStore'
import BaseToolbar from '../ui/BaseToolbar.vue'
import BaseButton from '../ui/BaseButton.vue'

const router = useRouter()
const { t } = useI18n()
const freePlay = useFreePlayStore()
const settings = useSettingsStore()

const props = defineProps<{
  isFullscreen: boolean
  isPlaying?: boolean
  settingsOpen?: boolean
  metronomeOpen?: boolean
  keyboardRangeOpen?: boolean
  labelsOpen?: boolean
}>()

const emit = defineEmits<{
  startRecording: []
  stopRecording: []
  togglePlayback: []
  rewind: []
  exportMidi: []
  importMidi: []
  openPractice: []
  openTrackEditor: []
  deleteRecording: []
  openSettings: [event: MouseEvent]
  openMetronome: [event: MouseEvent]
  openKeyboardRange: [event: MouseEvent]
  openLabels: [event: MouseEvent]
  toggleFullscreen: []
}>()

const recordButtonTitle = computed(() => freePlay.status === 'recording' ? t('freePlay.stopRecording') : t('freePlay.record'))
const recordingTime = computed(() => formatDuration(freePlay.recordingDurationUs))
const currentBPM = computed(() => freePlay.bpm)

function formatDuration(durationUs: number) {
  const totalSeconds = Math.floor(durationUs / 1_000_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function back() {
  router.push('/')
}

function toggleRecording() {
  if (freePlay.status === 'recording') emit('stopRecording')
  else emit('startRecording')
}

const currentZoomPercent = computed(() => Math.round(3.25 / settings.showDuration * 100))

function zoomOut() {
  const newPercent = Math.max(50, currentZoomPercent.value - 10)
  settings.setShowDuration(3.25 / (newPercent / 100))
}

function zoomIn() {
  const newPercent = Math.min(200, currentZoomPercent.value + 10)
  settings.setShowDuration(3.25 / (newPercent / 100))
}
</script>

<template>
  <BaseToolbar variant="header">
    <template #left>
      <BaseButton variant="secondary" :title="t('freePlay.backToHome')" @click="back">{{ t('common.back') }}</BaseButton>
      <div class="record-actions" :aria-label="t('freePlay.recordingActions')">
        <BaseButton v-if="freePlay.hasRecording" variant="icon" class="export-button" :title="t('freePlay.exportMidi')" :aria-label="t('freePlay.exportMidi')" @click="emit('exportMidi')">
          <i class="fas fa-arrow-up-from-bracket"></i>
        </BaseButton>
        <BaseButton
          variant="icon"
          class="import-button"
          :disabled="freePlay.status === 'recording'"
          :title="t('freePlay.importMidi')"
          :aria-label="t('freePlay.importMidi')"
          @click="emit('importMidi')"
        >
          <i class="fas fa-file-import"></i>
        </BaseButton>
        <BaseButton
          v-if="freePlay.hasRecording"
          variant="icon"
          class="practice-button"
          :title="t('freePlay.practice')"
          :aria-label="t('freePlay.practice')"
          @click="emit('openPractice')"
        >
          <i class="fas fa-graduation-cap"></i>
        </BaseButton>
        <BaseButton
          variant="icon"
          class="edit-button"
          :disabled="freePlay.status === 'recording'"
          :title="t('freePlay.openTrackEditor')"
          :aria-label="t('freePlay.openTrackEditor')"
          @click="emit('openTrackEditor')"
        >
          <i class="fas fa-pen-to-square"></i>
        </BaseButton>
        <BaseButton v-if="freePlay.hasRecording" variant="icon" class="delete-button" :title="t('freePlay.deleteRecording')" :aria-label="t('freePlay.deleteRecording')" @click="emit('deleteRecording')">
          <i class="fas fa-trash-alt"></i>
        </BaseButton>
      </div>
    </template>

    <template #center>
      <BaseButton
        variant="icon"
        class="rewind-toggle"
        :disabled="freePlay.status === 'recording' || !freePlay.hasRecording || freePlay.viewUs === 0"
        :title="t('freePlay.rewindToStart', 'Về đầu bài')"
        :aria-label="t('freePlay.rewindToStart', 'Về đầu bài')"
        @click="emit('rewind')"
      >
        <i class="fas fa-backward-step"></i>
      </BaseButton>
      <BaseButton
        variant="icon"
        class="play-toggle"
        :class="{ 'playing': props.isPlaying }"
        :disabled="freePlay.status === 'recording' || !freePlay.hasRecording"
        :title="props.isPlaying ? t('freePlay.stopPlayback', 'Dừng phát') : t('freePlay.startPlayback', 'Phát thử')"
        :aria-label="props.isPlaying ? t('freePlay.stopPlayback', 'Dừng phát') : t('freePlay.startPlayback', 'Phát thử')"
        @click="emit('togglePlayback')"
      >
        <i :class="props.isPlaying ? 'fas fa-stop' : 'fas fa-play'"></i>
      </BaseButton>
      <BaseButton
        variant="icon"
        class="record-toggle"
        :class="{ 'recording': freePlay.status === 'recording' }"
        :title="recordButtonTitle"
        :aria-label="recordButtonTitle"
        @click="toggleRecording"
      >
        <i :class="freePlay.status === 'recording' ? 'fas fa-stop' : 'fas fa-circle'"></i>
      </BaseButton>
      <div class="record-time" :class="{ 'record-time--active': freePlay.status === 'recording' }">
        {{ t('freePlay.recordingTimer', { time: recordingTime }) }}
      </div>
      <div class="tempo-control">
        <BaseButton variant="icon" :title="t('freePlay.bpmDown')" :aria-label="t('freePlay.bpmDown')" @click="freePlay.decreaseBpm">
          <i class="fas fa-minus"></i>
        </BaseButton>
        <div class="tempo-display">{{ t('play.bpmLabel', { value: currentBPM }) }}</div>
        <BaseButton variant="icon" :title="t('freePlay.bpmUp')" :aria-label="t('freePlay.bpmUp')" @click="freePlay.increaseBpm">
          <i class="fas fa-plus"></i>
        </BaseButton>
      </div>
      <div class="tempo-control">
        <BaseButton variant="icon" :title="t('play.zoomOut', 'Thu nhỏ')" :aria-label="t('play.zoomOut', 'Thu nhỏ')" @click="zoomOut">
          <i class="fas fa-search-minus"></i>
        </BaseButton>
        <div class="zoom-display">
          <div class="zoom-percent">{{ currentZoomPercent }}%</div>
          <div class="zoom-label">Zoom</div>
        </div>
        <BaseButton variant="icon" :title="t('play.zoomIn', 'Phóng to')" :aria-label="t('play.zoomIn', 'Phóng to')" @click="zoomIn">
          <i class="fas fa-search-plus"></i>
        </BaseButton>
      </div>
      <BaseButton variant="icon" :active="metronomeOpen" :title="t('play.metronome')" :aria-label="t('play.metronome')" @click="(event) => emit('openMetronome', event)"><i class="fas fa-drum"></i></BaseButton>
    </template>

    <template #right>
      <BaseButton variant="icon" :active="settingsOpen" :title="t('common.settings')" :aria-label="t('common.settings')" @click="(event) => emit('openSettings', event)"><i class="fas fa-cog"></i></BaseButton>
      <BaseButton variant="icon" :active="keyboardRangeOpen" :title="t('play.keyboardRange')" :aria-label="t('play.keyboardRange')" @click="(event) => emit('openKeyboardRange', event)"><i class="fas fa-keyboard"></i></BaseButton>
      <BaseButton variant="icon" :active="labelsOpen" :title="t('play.noteLabels')" :aria-label="t('play.noteLabels')" @click="(event) => emit('openLabels', event)"><i class="fas fa-tags"></i></BaseButton>
      <BaseButton variant="icon" :title="props.isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" :aria-label="props.isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" @click="emit('toggleFullscreen')">
        <i :class="props.isFullscreen ? 'fas fa-compress' : 'fas fa-expand'"></i>
      </BaseButton>
    </template>
  </BaseToolbar>
</template>

<style scoped>
.record-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.record-toggle {
  color: #ff2b2b;
}

.record-toggle.recording {
  color: #ffffff;
  background: rgba(239, 68, 68, 0.78);
  border-color: rgba(248, 113, 113, 0.9);
}

.play-toggle {
  color: #4ade80;
}

.play-toggle.playing {
  color: #ffffff;
  background: rgba(34, 197, 94, 0.78);
  border-color: rgba(74, 222, 128, 0.9);
}

.record-time {
  min-width: 6.75rem;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.record-time--active {
  color: #fecaca;
}

.tempo-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.tempo-display {
  min-width: 4.5rem;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-weight: 600;
  text-align: center;
}

.zoom-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 4.5rem;
  height: 36px;
  padding: 0 0.6rem;
  border-radius: 4px;
  background: var(--color-bg-subtle);
  line-height: 1.2;
}

.zoom-percent {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.zoom-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  margin-top: 0.05rem;
}

:deep(.base-toolbar-left .base-btn) {
  height: 36px;
}

.record-actions {
  margin-left: 0.35rem;
  padding-left: 0.5rem;
  border-left: 1px solid rgba(255, 255, 255, 0.14);
}

.export-button {
  color: #bfdbfe;
  background: rgba(14, 116, 144, 0.7);
}

.practice-button {
  color: #a7f3d0;
  background: rgba(6, 95, 70, 0.7);
}

.edit-button {
  color: #fde68a;
  background: rgba(120, 53, 15, 0.62);
}

.delete-button {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.55);
}
</style>

