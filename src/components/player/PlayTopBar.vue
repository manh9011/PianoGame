<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../../stores/playerStore'
import { parseMidi } from '../../modules/midi/midiParser'
import { buildTempoMap } from '../../modules/midi/midiTempo'
import { base64ToBuffer } from '../../modules/library/songLibrary'

const router = useRouter()
const player = usePlayerStore()

defineProps<{
  isFullscreen: boolean
  bookmarksDialogOpen?: boolean
  loopDialogOpen?: boolean
  benchmarkMode?: boolean
}>()

const emit = defineEmits<{
  openMetronome: [event: MouseEvent]
  openTrackConfig: [event: MouseEvent]
  openKeyboardRange: [event: MouseEvent]
  openLabels: [event: MouseEvent]
  openBookmarks: []
  openLoop: [event: MouseEvent]
  openSettings: [event: MouseEvent]
  toggleBenchmark: []
  toggleFullscreen: []
}>()

const currentSpeed = computed(() => player.session?.speed ?? 100)

const baseBPM = computed(() => {
  try {
    if (!player.song?.data) return 120
    const midi = parseMidi(base64ToBuffer(player.song.data))
    const tempoMap = buildTempoMap(midi)
    const baseTempo = tempoMap[0].microsecondsPerQuarter
    return 60_000_000 / baseTempo
  } catch {
    return 120
  }
})

const currentBPM = computed(() => Math.round(baseBPM.value * (currentSpeed.value / 100)))

const loopActive = computed(() => player.session?.loopState.enabled ?? false)

function backDisabled() { return player.session?.mode === 'performance' && !player.stats }
function back() { if (backDisabled()) return; player.clock?.stop(); player.autoPlayer.allNotesOff(player.session); router.push(`/mode-select/${player.song?.hash}`) }
function seekToStart() { player.seekToProgress(0) }
function seekToEnd() { player.seekToProgress(1) }

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
        <button class="top-button secondary" :disabled="backDisabled()" @click="back">Back</button>
        <button class="top-button secondary">Help</button>
        <button
          class="top-button secondary benchmark-toggle"
          :class="{ 'benchmark-toggle--active': benchmarkMode }"
          :aria-pressed="benchmarkMode"
          title="Toggle benchmark FPS"
          @click="emit('toggleBenchmark')"
        >
          Benchmark
        </button>
      </div>

      <div class="center-controls">
        <button class="icon-button" :disabled="!player.session.modeConfig.pauseAllowed" @click="player.togglePause">
          <i :class="player.clock?.state.running ? 'fas fa-pause' : 'fas fa-play'"></i>
        </button>
        <button class="icon-button" :disabled="!player.canSeek" @click="seekToStart">
          <i class="fas fa-step-backward"></i>
        </button>
        <button class="icon-button" :disabled="!player.canSeek" @click="seekToEnd">
          <i class="fas fa-step-forward"></i>
        </button>

        <div class="tempo-control">
          <button
            class="tempo-btn"
            :disabled="!player.session.modeConfig.speedChangeAllowed"
            @click="decreaseSpeed"
            aria-label="Giảm tốc độ"
          >
            <i class="fas fa-minus"></i>
          </button>
          <div class="tempo-display">
            <div class="tempo-percent">{{ currentSpeed }}%</div>
            <div class="tempo-bpm">{{ currentBPM }} BPM</div>
          </div>
          <button
            class="tempo-btn"
            :disabled="!player.session.modeConfig.speedChangeAllowed"
            @click="increaseSpeed"
            aria-label="Tăng tốc độ"
          >
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>

      <div class="right-controls">
        <button class="icon-button" title="Settings" @click="(e) => emit('openSettings', e)"><i class="fas fa-cog"></i></button>
        <button class="icon-button" title="Metronome" @click="(e) => emit('openMetronome', e)"><i class="fas fa-drum"></i></button>
        <button class="icon-button" title="Track Settings" @click="(e) => emit('openTrackConfig', e)"><i class="fas fa-sliders-h"></i></button>
        <button class="icon-button" title="Keyboard Range" @click="(e) => emit('openKeyboardRange', e)"><i class="fas fa-keyboard"></i></button>
        <button class="icon-button" title="Finger"><i class="fas fa-hand"></i></button>
        <button class="icon-button" :class="{ 'bookmark-active': bookmarksDialogOpen }" title="Bookmarks" @click="emit('openBookmarks')"><i class="fas fa-bookmark"></i></button>
        <button class="icon-button" title="Labels" @click="(e) => emit('openLabels', e)"><i class="fas fa-tags"></i></button>
        <button class="icon-button" :class="{ 'loop-active': loopActive || loopDialogOpen }" title="Loop" @click="(e) => emit('openLoop', e)"><i class="fas fa-repeat"></i></button>
        <button class="icon-button" title="Fullscreen" @click="emit('toggleFullscreen')">
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

.top-button.benchmark-toggle--active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.top-button.benchmark-toggle--active:hover:not(:disabled) {
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
