<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFreePlayStore } from '../../stores/freePlayStore'
import BaseToolbar from '../ui/BaseToolbar.vue'
import BaseButton from '../ui/BaseButton.vue'

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

.edit-button {
  color: #fde68a;
  background: rgba(120, 53, 15, 0.62);
}

.delete-button {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.55);
}
</style>

