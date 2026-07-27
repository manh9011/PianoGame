<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../../stores/playerStore'
import { getTempoPointAtMicroseconds, microsecondsPerQuarterToBpm } from '../../modules/midi/midiTempo'

const DEBUG = import.meta.env.DEV
const router = useRouter()
const { t } = useI18n()
const player = usePlayerStore()

const props = defineProps<{
  isFullscreen: boolean
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
</script>

<template>
  <header v-if="player.session" class="play-top-bar">
    <div class="top-main-row">
      <div class="left-controls">
        <button class="top-button secondary" :title="t('play.backToModes')" @click="back">{{ t('common.back') }}</button>
        <button
          class="top-button secondary help-toggle"
          :class="{ 'help-toggle--active': helpOverlayOpen }"
          :aria-pressed="helpOverlayOpen"
          :title="t('play.helpToggle')"
          @click="emit('toggleHelp')"
        >
          {{ t('play.help') }}
        </button>
        <button
          v-if="DEBUG"
          class="top-button secondary benchmark-toggle"
          :class="{ 'benchmark-toggle--active': benchmarkMode }"
          :aria-pressed="benchmarkMode"
          :title="t('play.benchmarkToggle')"
          @click="emit('toggleBenchmark')"
        >
          {{ t('play.benchmark') }}
        </button>
        <button
          v-if="DEBUG"
          class="top-button secondary benchmark-toggle"
          :class="{ 'benchmark-toggle--active': performanceAutoPlay }"
          :aria-pressed="performanceAutoPlay"
          :title="t('perf.autoPlayTest')"
          @click="emit('togglePerformanceAutoPlay')"
        >
          {{ t('perf.autoPlayTest') }}
        </button>
      </div>

      <div class="center-controls">
        <button
          class="icon-button"
          data-help-anchor="play-pause"
          :disabled="playbackControlsDisabled"
          :title="playButtonTitle"
          :aria-label="player.playbackRunning ? t('play.stop') : t('play.play')"
          @click="togglePlayback"
        >
          <i :class="player.playbackRunning ? 'fas fa-stop' : 'fas fa-play'"></i>
        </button>
        <button class="icon-button" data-help-anchor="previous-bookmark" :disabled="seekControlsDisabled" :title="t('play.previousBookmark')" :aria-label="t('play.previousBookmark')" @click="seekToPreviousBookmark">
          <i class="fas fa-step-backward"></i>
        </button>
        <button class="icon-button" data-help-anchor="next-bookmark" :disabled="seekControlsDisabled" :title="t('play.nextBookmark')" :aria-label="t('play.nextBookmark')" @click="seekToNextBookmark">
          <i class="fas fa-step-forward"></i>
        </button>

        <div class="tempo-control">
          <button
            class="tempo-btn"
            data-help-anchor="speed-down"
            :disabled="speedControlsDisabled"
            :title="t('play.speedDown')"
            @click="decreaseSpeed"
            :aria-label="t('play.speedDown')"
          >
            <i class="fas fa-minus"></i>
          </button>
          <div class="tempo-display">
            <div class="tempo-percent">{{ currentSpeed }}%</div>
            <div class="tempo-bpm">{{ t('play.bpmLabel', { value: currentBPM }) }}</div>
          </div>
          <button
            class="tempo-btn"
            data-help-anchor="speed-up"
            :disabled="speedControlsDisabled"
            :title="t('play.speedUp')"
            @click="increaseSpeed"
            :aria-label="t('play.speedUp')"
          >
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>

      <div class="right-controls">
        <button class="icon-button" data-help-anchor="settings" :title="t('common.settings')" :aria-label="t('common.settings')" @click="(e) => emit('openSettings', e)"><i class="fas fa-cog"></i></button>
        <button class="icon-button" data-help-anchor="metronome" :title="t('play.metronome')" :aria-label="t('play.metronome')" @click="(e) => emit('openMetronome', e)"><i class="fas fa-drum"></i></button>
        <button class="icon-button" data-help-anchor="track-config" :title="t('play.trackConfig')" :aria-label="t('play.trackConfig')" @click="(e) => emit('openTrackConfig', e)"><i class="fas fa-sliders-h"></i></button>
        <button class="icon-button" data-help-anchor="keyboard-range" :title="t('play.keyboardRange')" :aria-label="t('play.keyboardRange')" @click="(e) => emit('openKeyboardRange', e)"><i class="fas fa-keyboard"></i></button>
        <button class="icon-button" data-help-anchor="finger-hints" :class="{ 'finger-active': fingerDialogOpen }" :title="t('play.fingerHints')" :aria-label="t('play.fingerHints')" @click="(e) => emit('openFinger', e)"><i class="fas fa-hand"></i></button>
        <button class="icon-button" data-help-anchor="bookmarks" :class="{ 'bookmark-active': bookmarksDialogOpen }" :title="t('play.bookmarks')" :aria-label="t('play.bookmarks')" @click="emit('openBookmarks')"><i class="fas fa-bookmark"></i></button>
        <button class="icon-button" data-help-anchor="note-labels" :title="t('play.noteLabels')" :aria-label="t('play.noteLabels')" @click="(e) => emit('openLabels', e)"><i class="fas fa-tags"></i></button>
        <button class="icon-button" data-help-anchor="looping" :class="{ 'loop-active': loopActive || loopDialogOpen }" :title="t('play.loop')" :aria-label="t('play.loop')" @click="(e) => emit('openLoop', e)"><i class="fas fa-repeat"></i></button>
        <button class="icon-button" data-help-anchor="fullscreen" :title="isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" :aria-label="isFullscreen ? t('play.exitFullscreen') : t('play.fullscreen')" @click="emit('toggleFullscreen')">
          <i :class="isFullscreen ? 'fas fa-compress' : 'fas fa-expand'"></i>
        </button>
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

.top-button.benchmark-toggle--active,
.top-button.help-toggle--active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.top-button.benchmark-toggle--active:hover:not(:disabled),
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

.icon-button.bookmark-active {
  color: #FFBB32;
  background: rgba(255, 187, 50, 0.15);
  border-color: rgba(255, 187, 50, 0.4);
}

.icon-button.bookmark-active:hover {
  background: rgba(255, 187, 50, 0.25);
  border-color: rgba(255, 187, 50, 0.5);
}

.icon-button.loop-active,
.icon-button.finger-active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.icon-button.loop-active:hover,
.icon-button.finger-active:hover {
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
