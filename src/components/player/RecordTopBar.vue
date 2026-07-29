<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../../stores/playerStore'
import { useRecordStore, type RecordExportPreset } from '../../stores/recordStore'
import { getTempoPointAtMicroseconds, microsecondsPerQuarterToBpm } from '../../modules/midi/midiTempo'
import BaseToolbar from '../ui/BaseToolbar.vue'
import BaseButton from '../ui/BaseButton.vue'

const router = useRouter()
const { t } = useI18n()
const player = usePlayerStore()
const record = useRecordStore()

const props = defineProps<{
  settingsOpen?: boolean
  visualSettingsOpen?: boolean
  trackConfigOpen?: boolean
  keyboardRangeOpen?: boolean
  labelsOpen?: boolean
  renderMenuOpen?: boolean
}>()

const emit = defineEmits<{
  openSettings: [event: MouseEvent]
  openVisualSettings: [event: MouseEvent]
  openTrackConfig: [event: MouseEvent]
  openKeyboardRange: [event: MouseEvent]
  openLabels: [event: MouseEvent]
  toggleRenderMenu: [event: MouseEvent]
  closeRenderMenu: []
  runRenderPreset: [preset: RecordExportPreset]
}>()

const renderMenuWrap = ref<HTMLElement | null>(null)

const currentSpeed = computed(() => player.session?.speed ?? 100)
const baseBPM = computed(() => {
  const session = player.session
  if (!session?.tempoMap.length) return 120
  const currentUs = Math.max(0, session.currentUs)
  const tempoPoint = getTempoPointAtMicroseconds(currentUs, session.tempoMap)
  return microsecondsPerQuarterToBpm(tempoPoint.microsecondsPerQuarter)
})
const currentBPM = computed(() => Math.round(baseBPM.value * (currentSpeed.value / 100)))

const isCropped = computed(() => {
  const totalUs = player.session?.loopState.durationUs ?? player.clock?.seekableDurationUs ?? 0
  if (!totalUs) return false
  return record.cropStartUs > 0 || (record.cropEndUs > 0 && record.cropEndUs < totalUs)
})

function resetCrop() {
  const totalUs = player.session?.loopState.durationUs ?? player.clock?.seekableDurationUs ?? 0
  if (totalUs) {
    record.resetCrop(totalUs)
  }
}

function back() {
  player.clock?.stop()
  player.autoPlayer.allNotesOff(player.session)
  router.push('/library')
}

function togglePlayback() {
  if (player.playbackRunning) player.stopPlayback()
  else player.start()
}

function increaseSpeed() {
  const newSpeed = Math.min(400, (player.session?.speed ?? 100) + 10)
  player.setSpeed(newSpeed)
}

function decreaseSpeed() {
  const newSpeed = Math.max(10, (player.session?.speed ?? 100) - 10)
  player.setSpeed(newSpeed)
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!props.renderMenuOpen) return
  const target = event.target
  if (!(target instanceof Node) || renderMenuWrap.value?.contains(target)) return
  emit('closeRenderMenu')
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <BaseToolbar v-if="player.session" variant="header" class="record-top-bar">
    <template #left>
      <BaseButton variant="secondary" :title="t('record.backToLibrary')" @click="back">{{ t('common.back') }}</BaseButton>
    </template>

    <template #center>
      <BaseButton
        variant="icon"
        :title="t('play.playPause')"
        :aria-label="player.playbackRunning ? t('play.stop') : t('play.play')"
        @click="togglePlayback"
      >
        <i :class="player.playbackRunning ? 'fas fa-stop' : 'fas fa-play'"></i>
      </BaseButton>

      <div class="tempo-control">
        <BaseButton variant="icon" :title="t('play.speedDown')" :aria-label="t('play.speedDown')" @click="decreaseSpeed">
          <i class="fas fa-minus"></i>
        </BaseButton>
        <div class="tempo-display">
          <div class="tempo-percent">{{ currentSpeed }}%</div>
          <div class="tempo-bpm">{{ t('play.bpmLabel', { value: currentBPM }) }}</div>
        </div>
        <BaseButton variant="icon" :title="t('play.speedUp')" :aria-label="t('play.speedUp')" @click="increaseSpeed">
          <i class="fas fa-plus"></i>
        </BaseButton>
      </div>
      
      <div ref="renderMenuWrap" class="render-menu-wrap">
        <BaseButton variant="secondary" class="render-button" :active="renderMenuOpen" @click="(event) => emit('toggleRenderMenu', event)">
          {{ t('record.render') }}
        </BaseButton>
        <div v-if="renderMenuOpen" class="render-menu" role="menu">
          <button type="button" role="menuitem" @click="emit('runRenderPreset', 'mp4-full')">{{ t('record.presets.mp4Full') }}</button>
          <button type="button" role="menuitem" @click="emit('runRenderPreset', 'webm-full')">{{ t('record.presets.webmFull') }}</button>
          <button type="button" role="menuitem" @click="emit('runRenderPreset', 'mp4-10s')">{{ t('record.presets.mp410s') }}</button>
          <button type="button" role="menuitem" @click="emit('runRenderPreset', 'webm-10s')">{{ t('record.presets.webm10s') }}</button>
        </div>
      </div>

      <BaseButton
        variant="icon"
        :title="t('record.resetCrop')"
        :aria-label="t('record.resetCrop')"
        :disabled="!isCropped"
        @click="resetCrop"
      >
        <i class="fas fa-undo"></i>
      </BaseButton>
    </template>

    <template #right>
      <BaseButton variant="icon" :active="settingsOpen" :title="t('common.settings')" :aria-label="t('common.settings')" @click="(event) => emit('openSettings', event)"><i class="fas fa-cog"></i></BaseButton>
      <BaseButton variant="icon" :active="visualSettingsOpen" :title="t('record.visualSettings')" :aria-label="t('record.visualSettings')" @click="(event) => emit('openVisualSettings', event)"><i class="fas fa-image"></i></BaseButton>
      <BaseButton variant="icon" :active="trackConfigOpen" :title="t('play.trackConfig')" :aria-label="t('play.trackConfig')" @click="(event) => emit('openTrackConfig', event)"><i class="fas fa-sliders-h"></i></BaseButton>
      <BaseButton variant="icon" :active="keyboardRangeOpen" :title="t('play.keyboardRange')" :aria-label="t('play.keyboardRange')" @click="(event) => emit('openKeyboardRange', event)"><i class="fas fa-keyboard"></i></BaseButton>
      <BaseButton variant="icon" :active="labelsOpen" :title="t('play.noteLabels')" :aria-label="t('play.noteLabels')" @click="(event) => emit('openLabels', event)"><i class="fas fa-tags"></i></BaseButton>
    </template>
  </BaseToolbar>
</template>

<style scoped>
.tempo-control {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.tempo-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 4.5rem;
  height: 36px;
  padding: 0 0.6rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
  line-height: 1.2;
}

:deep(.base-toolbar-left .base-btn) {
  height: 36px;
}

.tempo-percent {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tempo-bpm {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin-top: 0.05rem;
}

.record-top-bar {
  position: relative;
}

.render-button {
  min-width: 6.5rem;
  height: 36px;
}

.render-menu-wrap {
  position: relative;
}

.render-menu {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  display: grid;
  min-width: 13rem;
  padding: 0.35rem;
  border: 1px solid var(--color-border-default);
  border-radius: 0.55rem;
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-lg);
  z-index: 30;
}

.render-menu::before {
  content: '';
  position: absolute;
  top: -0.48rem;
  right: 2.85rem;
  width: 0.85rem;
  height: 0.85rem;
  border-top: 1px solid var(--color-border-default);
  border-left: 1px solid var(--color-border-default);
  background: var(--color-bg-elevated);
  transform: rotate(45deg);
}

.render-menu button {
  min-height: 2.25rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
  padding: 0.42rem 0.7rem;
  cursor: pointer;
}

.render-menu button:hover {
  background: var(--color-bg-hover);
}


</style>
