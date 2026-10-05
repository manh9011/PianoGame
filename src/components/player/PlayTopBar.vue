<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import BaseButton from '../ui/BaseButton.vue'
import { getTempoPointAtMicroseconds, microsecondsPerQuarterToBpm } from '../../modules/midi/midiTempo'

const DEBUG = import.meta.env.DEV
const router = useRouter()
const { t } = useI18n()
const player = usePlayerStore()
const settings = useSettingsStore()

const props = defineProps<{
  isFullscreen: boolean
  fullscreenAvailable?: boolean
  bookmarksDialogOpen?: boolean
  loopDialogOpen?: boolean
  fingerDialogOpen?: boolean
  helpOverlayOpen?: boolean
  benchmarkMode?: boolean
  performanceAutoPlay?: boolean
  playbackBlocked?: boolean
}>()

const emit = defineEmits<{
  openMetronome: [event: MouseEvent]
  openTrackConfig: [event: MouseEvent]
  openKeyboardRange: [event: MouseEvent]
  openFinger: [event: MouseEvent]
  openLabels: [event: MouseEvent]
  openBookmarks: []
  openLoop: [event: MouseEvent]
  openSettings: [event: MouseEvent]
  toggleBenchmark: []
  togglePerformanceAutoPlay: []
  toggleHelp: []
  toggleFullscreen: []
  stopPlayback: []
}>()

const currentSpeed = computed(() => player.session?.speed ?? 100)

const baseBPM = computed(() => {
  const session = player.session
  if (!session?.tempoMap.length) return 120
  const currentUs = Math.max(0, session.currentUs)
  const tempoPoint = getTempoPointAtMicroseconds(currentUs, session.tempoMap)
  return microsecondsPerQuarterToBpm(tempoPoint.microsecondsPerQuarter)
})

const currentBPM = computed(() => Math.round(baseBPM.value * (currentSpeed.value / 100)))

const loopActive = computed(() => player.loopRegionConfigured)

function back() {
  player.clock?.stop()
  player.autoPlayer.allNotesOff(player.session)
  const hash = player.song?.playbackHash ?? player.song?.hash
  router.push(hash ? `/mode-select/${hash}` : '/library')
}
function seekToPreviousBookmark() { player.seekToPreviousBookmark() }
function seekToNextBookmark() { player.seekToNextBookmark() }
function togglePlayback() {
  if (props.playbackBlocked) return
  if (player.playbackRunning) player.stopPlayback()
  else player.start()
}

const playButtonTitle = computed(() => {
  if (player.interactionLocked) return t('play.playLocked')
  if (props.playbackBlocked) return t('sheetMusic.waitingReady')
  return t('play.playPause')
})

const playbackControlsDisabled = computed(() => !!props.playbackBlocked)

const speedControlsDisabled = computed(() => playbackControlsDisabled.value || !player.session?.modeConfig.speedChangeAllowed)

const seekControlsDisabled = computed(() => playbackControlsDisabled.value || !player.canSeek)

function increaseSpeed() {
  if (!player.session?.modeConfig.speedChangeAllowed) return
  const newSpeed = Math.min(400, (player.session?.speed ?? 100) + 10)
  player.setSpeed(newSpeed)
}

function decreaseSpeed() {
  if (!player.session?.modeConfig.speedChangeAllowed) return
  const newSpeed = Math.max(10, (player.session?.speed ?? 100) - 10)
  player.setSpeed(newSpeed)
}

const currentZoomPercent = computed(() => settings.zoomPercent)

function zoomOut() {
  const newPercent = Math.max(50, currentZoomPercent.value - 10)
  settings.setZoomPercent(newPercent)
}

function zoomIn() {
  const newPercent = Math.min(200, currentZoomPercent.value + 10)
  settings.setZoomPercent(newPercent)
}
</script>

<template>
  <header v-if="player.session" class="play-top-bar">
    <div class="top-main-row">
      <div class="left-controls">
        <BaseButton variant="secondary" :title="t('play.backToModes')" @click="back">{{ t('common.back') }}</BaseButton>
        <BaseButton variant="secondary" :active="helpOverlayOpen" :title="t('play.helpToggle')" @click="emit('toggleHelp')">
          {{ t('play.help') }}
        </BaseButton>
        <BaseButton
          v-if="DEBUG"
          variant="secondary"
          :active="benchmarkMode"
          :title="t('play.benchmarkToggle')"
          @click="emit('toggleBenchmark')"
        >
          {{ t('play.benchmark') }}
        </BaseButton>
        <BaseButton
          v-if="DEBUG"
          variant="secondary"
          :active="performanceAutoPlay"
          :title="t('perf.autoPlayTest')"
          @click="emit('togglePerformanceAutoPlay')"
        >
          {{ t('perf.autoPlayTest') }}
        </BaseButton>
      </div>

      <div class="center-controls">
        <BaseButton variant="icon" data-help-anchor="play-pause" :disabled="playbackControlsDisabled" :title="playButtonTitle" :aria-label="player.playbackRunning ? t('play.stop') : t('play.play')" @click="togglePlayback">
          <i :class="player.playbackRunning ? 'fas fa-stop' : 'fas fa-play'"></i>
        </BaseButton>
        <BaseButton variant="icon" data-help-anchor="previous-bookmark" :disabled="seekControlsDisabled" :title="t('play.previousBookmark')" :aria-label="t('play.previousBookmark')" @click="seekToPreviousBookmark">
          <i class="fas fa-step-backward"></i>
        </BaseButton>
        <BaseButton variant="icon" data-help-anchor="next-bookmark" :disabled="seekControlsDisabled" :title="t('play.nextBookmark')" :aria-label="t('play.nextBookmark')" @click="seekToNextBookmark">
          <i class="fas fa-step-forward"></i>
        </BaseButton>

        <div class="tempo-control">
          <BaseButton variant="icon" data-help-anchor="speed-down" :disabled="speedControlsDisabled" :title="t('play.speedDown')" :aria-label="t('play.speedDown')" @click="decreaseSpeed">
            <i class="fas fa-minus"></i>
          </BaseButton>
          <div class="tempo-display">
            <div class="tempo-percent">{{ currentSpeed }}%</div>
            <div class="tempo-bpm">{{ t('play.bpmLabel', { value: currentBPM }) }}</div>
          </div>
          <BaseButton variant="icon" data-help-anchor="speed-up" :disabled="speedControlsDisabled" :title="t('play.speedUp')" :aria-label="t('play.speedUp')" @click="increaseSpeed">
            <i class="fas fa-plus"></i>
          </BaseButton>
        </div>

        <div class="tempo-control">
          <BaseButton variant="icon" data-help-anchor="zoom-out" :title="t('play.zoomOut', 'Thu nhỏ')" :aria-label="t('play.zoomOut', 'Thu nhỏ')" @click="zoomOut">
            <i class="fas fa-search-minus"></i>
          </BaseButton>
          <div class="tempo-display">
            <div class="tempo-percent">{{ currentZoomPercent }}%</div>
            <div class="tempo-bpm">Zoom</div>
          </div>
          <BaseButton variant="icon" data-help-anchor="zoom-in" :title="t('play.zoomIn', 'Phóng to')" :aria-label="t('play.zoomIn', 'Phóng to')" @click="zoomIn">
            <i class="fas fa-search-plus"></i>
          </BaseButton>
        </div>
      </div>

      <div class="right-controls">
        <BaseButton variant="icon" data-help-anchor="settings" :title="t('common.settings')" :aria-label="t('common.settings')" @click="(e) => emit('openSettings', e)"><i class="fas fa-cog"></i></BaseButton>
        <BaseButton variant="icon" data-help-anchor="metronome" :title="t('play.metronome')" :aria-label="t('play.metronome')" @click="(e) => emit('openMetronome', e)"><i class="fas fa-drum"></i></BaseButton>
        <BaseButton variant="icon" data-help-anchor="track-config" :title="t('play.trackConfig')" :aria-label="t('play.trackConfig')" @click="(e) => emit('openTrackConfig', e)"><i class="fas fa-sliders-h"></i></BaseButton>
        <BaseButton variant="icon" data-help-anchor="keyboard-range" :title="t('play.keyboardRange')" :aria-label="t('play.keyboardRange')" @click="(e) => emit('openKeyboardRange', e)"><i class="fas fa-keyboard"></i></BaseButton>
        <BaseButton variant="icon" data-help-anchor="finger-hints" :active="fingerDialogOpen" :title="t('play.fingerHints')" :aria-label="t('play.fingerHints')" @click="(e) => emit('openFinger', e)"><i class="fas fa-hand"></i></BaseButton>
        <BaseButton variant="icon" data-help-anchor="bookmarks" :active="bookmarksDialogOpen" :title="t('play.bookmarks')" :aria-label="t('play.bookmarks')" @click="emit('openBookmarks')"><i class="fas fa-bookmark"></i></BaseButton>
        <BaseButton variant="icon" data-help-anchor="note-labels" :title="t('play.noteLabels')" :aria-label="t('play.noteLabels')" @click="(e) => emit('openLabels', e)"><i class="fas fa-tags"></i></BaseButton>
        <BaseButton variant="icon" data-help-anchor="looping" :active="loopActive || loopDialogOpen" :title="t('play.loop')" :aria-label="t('play.loop')" @click="(e) => emit('openLoop', e)"><i class="fas fa-repeat"></i></BaseButton>
        <BaseButton v-if="fullscreenAvailable !== false" variant="icon" data-help-anchor="fullscreen" :title="isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" :aria-label="isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" @click="emit('toggleFullscreen')">
          <i :class="isFullscreen ? 'fas fa-compress' : 'fas fa-expand'"></i>
        </BaseButton>
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

.tempo-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.left-controls .base-btn {
  height: 36px;
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
  background: var(--color-bg-subtle);
  line-height: 1.2;
}

.tempo-percent {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tempo-bpm {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  margin-top: 0.05rem;
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

