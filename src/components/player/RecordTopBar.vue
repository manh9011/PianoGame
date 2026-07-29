<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../../stores/playerStore'
import type { RecordExportPreset } from '../../stores/recordStore'
import { getTempoPointAtMicroseconds, microsecondsPerQuarterToBpm } from '../../modules/midi/midiTempo'

const router = useRouter()
const { t } = useI18n()
const player = usePlayerStore()

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
  <header v-if="player.session" class="play-top-bar record-top-bar">
    <div class="top-main-row">
      <div class="left-controls">
        <button class="top-button secondary" :title="t('record.backToLibrary')" @click="back">{{ t('common.back') }}</button>
      </div>

      <div class="center-controls">
        <button
          class="icon-button"
          :title="t('play.playPause')"
          :aria-label="player.playbackRunning ? t('play.stop') : t('play.play')"
          @click="togglePlayback"
        >
          <i :class="player.playbackRunning ? 'fas fa-stop' : 'fas fa-play'"></i>
        </button>

        <div class="tempo-control">
          <button class="tempo-btn" :title="t('play.speedDown')" :aria-label="t('play.speedDown')" @click="decreaseSpeed">
            <i class="fas fa-minus"></i>
          </button>
          <div class="tempo-display">
            <div class="tempo-percent">{{ currentSpeed }}%</div>
            <div class="tempo-bpm">{{ t('play.bpmLabel', { value: currentBPM }) }}</div>
          </div>
          <button class="tempo-btn" :title="t('play.speedUp')" :aria-label="t('play.speedUp')" @click="increaseSpeed">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        
        <div ref="renderMenuWrap" class="render-menu-wrap">
          <button class="top-button render-button" :class="{ 'help-toggle--active': renderMenuOpen }" @click="(event) => emit('toggleRenderMenu', event)">
            {{ t('record.render') }}
          </button>
          <div v-if="renderMenuOpen" class="render-menu" role="menu">
            <button type="button" role="menuitem" @click="emit('runRenderPreset', 'mp4-full')">{{ t('record.presets.mp4Full') }}</button>
            <button type="button" role="menuitem" @click="emit('runRenderPreset', 'webm-full')">{{ t('record.presets.webmFull') }}</button>
            <button type="button" role="menuitem" @click="emit('runRenderPreset', 'mp4-10s')">{{ t('record.presets.mp410s') }}</button>
            <button type="button" role="menuitem" @click="emit('runRenderPreset', 'webm-10s')">{{ t('record.presets.webm10s') }}</button>
          </div>
        </div>
      </div>

      <div class="right-controls">
        <button class="icon-button" :class="{ 'loop-active': settingsOpen }" :title="t('common.settings')" :aria-label="t('common.settings')" @click="(event) => emit('openSettings', event)"><i class="fas fa-cog"></i></button>
        <button class="icon-button" :class="{ 'loop-active': visualSettingsOpen }" :title="t('record.visualSettings')" :aria-label="t('record.visualSettings')" @click="(event) => emit('openVisualSettings', event)"><i class="fas fa-image"></i></button>
        <button class="icon-button" :class="{ 'loop-active': trackConfigOpen }" :title="t('play.trackConfig')" :aria-label="t('play.trackConfig')" @click="(event) => emit('openTrackConfig', event)"><i class="fas fa-sliders-h"></i></button>
        <button class="icon-button" :class="{ 'loop-active': keyboardRangeOpen }" :title="t('play.keyboardRange')" :aria-label="t('play.keyboardRange')" @click="(event) => emit('openKeyboardRange', event)"><i class="fas fa-keyboard"></i></button>
        <button class="icon-button" :class="{ 'loop-active': labelsOpen }" :title="t('play.noteLabels')" :aria-label="t('play.noteLabels')" @click="(event) => emit('openLabels', event)"><i class="fas fa-tags"></i></button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.play-top-bar {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border-default);
}

.top-main-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
}

.left-controls,
.center-controls,
.right-controls {
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

.top-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.top-button.help-toggle--active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.top-button.help-toggle--active:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.25);
  border-color: rgba(251, 191, 36, 0.5);
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

.icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-button.loop-active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.icon-button.loop-active:hover {
  background: rgba(251, 191, 36, 0.25);
  border-color: rgba(251, 191, 36, 0.5);
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

.tempo-btn:active:not(:disabled) {
  background: rgba(0, 0, 0, 0.3);
}

.tempo-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tempo-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 4.5rem;
  padding: 0 0.6rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
  line-height: 1.2;
}

.tempo-percent {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e3e4e8;
}

.tempo-bpm {
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 0.05rem;
}

.record-top-bar {
  position: relative;
}

.render-button {
  min-width: 6.5rem;
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.55rem;
  background: #3a3d42;
  box-shadow: 0 0.65rem 1.8rem rgba(0, 0, 0, 0.4);
  z-index: 30;
}

.render-menu::before {
  content: '';
  position: absolute;
  top: -0.48rem;
  right: 2.85rem;
  width: 0.85rem;
  height: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  background: #3a3d42;
  transform: rotate(45deg);
}

.render-menu button {
  min-height: 2.25rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  text-align: left;
  padding: 0.42rem 0.7rem;
  cursor: pointer;
}

.render-menu button:hover {
  background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 900px) {
  .top-main-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .left-controls,
  .right-controls {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
