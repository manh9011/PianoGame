<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFreePlayStore } from '../../stores/freePlayStore'

const router = useRouter()
const { t } = useI18n()
const freePlay = useFreePlayStore()

const props = defineProps<{
  isFullscreen: boolean
  settingsOpen?: boolean
  metronomeOpen?: boolean
  keyboardRangeOpen?: boolean
  labelsOpen?: boolean
}>()

const emit = defineEmits<{
  startRecording: []
  stopRecording: []
  exportMidi: []
  importMidi: []
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
</script>

<template>
  <header class="free-play-top-bar">
    <div class="top-main-row">
      <div class="left-controls">
        <button class="top-button secondary" :title="t('freePlay.backToHome')" @click="back">{{ t('common.back') }}</button>
        <div class="record-actions" :aria-label="t('freePlay.recordingActions')">
          <button v-if="freePlay.hasRecording" class="icon-button export-button" :title="t('freePlay.exportMidi')" :aria-label="t('freePlay.exportMidi')" @click="emit('exportMidi')">
            <i class="fas fa-arrow-up-from-bracket"></i>
          </button>
          <button
            class="icon-button import-button"
            :disabled="freePlay.status === 'recording'"
            :title="t('freePlay.importMidi')"
            :aria-label="t('freePlay.importMidi')"
            @click="emit('importMidi')"
          >
            <i class="fas fa-file-import"></i>
          </button>
          <button
            class="icon-button edit-button"
            :disabled="freePlay.status === 'recording'"
            :title="t('freePlay.openTrackEditor')"
            :aria-label="t('freePlay.openTrackEditor')"
            @click="emit('openTrackEditor')"
          >
            <i class="fas fa-pen-to-square"></i>
          </button>
          <button v-if="freePlay.hasRecording" class="icon-button delete-button" :title="t('freePlay.deleteRecording')" :aria-label="t('freePlay.deleteRecording')" @click="emit('deleteRecording')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>

      <div class="center-controls">
        <button
          class="icon-button record-toggle"
          :class="{ 'recording': freePlay.status === 'recording' }"
          :title="recordButtonTitle"
          :aria-label="recordButtonTitle"
          @click="toggleRecording"
        >
          <i :class="freePlay.status === 'recording' ? 'fas fa-stop' : 'fas fa-circle'"></i>
        </button>
        <div class="record-time" :class="{ 'record-time--active': freePlay.status === 'recording' }">
          {{ t('freePlay.recordingTimer', { time: recordingTime }) }}
        </div>
        <div class="tempo-control">
          <button class="tempo-btn" :title="t('freePlay.bpmDown')" :aria-label="t('freePlay.bpmDown')" @click="freePlay.decreaseBpm">
            <i class="fas fa-minus"></i>
          </button>
          <div class="tempo-display">{{ t('play.bpmLabel', { value: currentBPM }) }}</div>
          <button class="tempo-btn" :title="t('freePlay.bpmUp')" :aria-label="t('freePlay.bpmUp')" @click="freePlay.increaseBpm">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <button class="icon-button" :class="{ 'active': metronomeOpen }" :title="t('play.metronome')" :aria-label="t('play.metronome')" @click="(event) => emit('openMetronome', event)"><i class="fas fa-drum"></i></button>
      </div>

      <div class="right-controls">
        <button class="icon-button" :class="{ 'active': settingsOpen }" :title="t('common.settings')" :aria-label="t('common.settings')" @click="(event) => emit('openSettings', event)"><i class="fas fa-cog"></i></button>
        <button class="icon-button" :class="{ 'active': keyboardRangeOpen }" :title="t('play.keyboardRange')" :aria-label="t('play.keyboardRange')" @click="(event) => emit('openKeyboardRange', event)"><i class="fas fa-keyboard"></i></button>
        <button class="icon-button" :class="{ 'active': labelsOpen }" :title="t('play.noteLabels')" :aria-label="t('play.noteLabels')" @click="(event) => emit('openLabels', event)"><i class="fas fa-tags"></i></button>
        <button class="icon-button" :title="props.isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" :aria-label="props.isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" @click="emit('toggleFullscreen')">
          <i :class="props.isFullscreen ? 'fas fa-compress' : 'fas fa-expand'"></i>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.free-play-top-bar {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #2b2d31;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.top-main-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
}

.left-controls,
.center-controls,
.right-controls,
.record-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.center-controls {
  justify-content: center;
}

.top-button {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #e3e4e8;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.top-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.icon-button {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: #e3e4e8;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
}

.icon-button.active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.record-toggle {
  color: #ff2b2b;
}

.record-toggle.recording {
  color: #ffffff;
  background: rgba(239, 68, 68, 0.78);
  border-color: rgba(248, 113, 113, 0.9);
}

.record-time {
  min-width: 6.75rem;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  color: #d1d5db;
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

.tempo-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #e3e4e8;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tempo-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
}

.tempo-display {
  min-width: 4.5rem;
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
  color: #e3e4e8;
  font-weight: 600;
  text-align: center;
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

.edit-button {
  color: #fde68a;
  background: rgba(120, 53, 15, 0.62);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.delete-button {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.55);
}

@media (max-width: 900px) {
  .top-main-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .left-controls,
  .right-controls {
    justify-content: center;
  }
}
</style>
