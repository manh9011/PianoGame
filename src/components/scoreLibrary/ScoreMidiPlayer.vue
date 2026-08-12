<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import BaseButton from '../ui/BaseButton.vue'
import { parseMidi } from '../../modules/midi/midiParser'
import { translateNotes, translateControlChanges } from '../../modules/midi/midiNoteTranslator'
import { buildTempoMap, pulseToMicroseconds } from '../../modules/midi/midiTempo'
import { assignHands } from '../../modules/game/handAssignment'
import { createDefaultTrackProperties } from '../../modules/game/trackProperties'
import { createPlaySession, PLAY_MODE_CONFIGS } from '../../modules/game/playSession'
import { AutoNotePlayer } from '../../modules/audio/autoNotePlayer'
import { MidiPlayerClock } from '../../modules/midi/midiPlayerClock'
import type { PlaySession } from '../../modules/game/playSession'

interface Props {
  midiBlob: Blob | null
  loading: boolean
  userId?: string
  scoreId?: string
}

const props = defineProps<Props>()

const playing = ref(false)
const paused = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)
const seekPercent = ref(0)
const fetching = ref(false)
const internalBlob = ref<Blob | null>(null)

const emit = defineEmits<{
  'midiFetched': [blob: Blob]
}>()

let clock: MidiPlayerClock | null = null
let session: PlaySession | null = null
let activePlayer: AutoNotePlayer | null = null
let durationUs = 0

function stopPlayback() {
  clock?.stop()
  clock = null
  activePlayer?.allNotesOff(null)
  activePlayer = null
  session = null
  playing.value = false
  paused.value = false
  currentTime.value = 0
  seekPercent.value = 0
  durationUs = 0
  duration.value = 0
}

async function parseAndPlay() {
  const blob = props.midiBlob ?? internalBlob.value
  if (!blob) {
    if (!props.userId || !props.scoreId) return
    fetching.value = true
    try {
      const { fetchMidiBlob } = await import('../../modules/scoreLibrary/scoreLibraryApi')
      internalBlob.value = await fetchMidiBlob(props.userId, props.scoreId)
      emit('midiFetched', internalBlob.value)
    } catch {
      fetching.value = false
      return
    }
    fetching.value = false
  }

  const activeBlob = props.midiBlob ?? internalBlob.value
  if (!activeBlob) return

  stopPlayback()

  const buffer = await activeBlob.arrayBuffer()

  const midi = parseMidi(buffer)
  const { notes } = assignHands(translateNotes(midi))
  const controlChanges = translateControlChanges(midi)
  const trackIds = [...new Set(notes.map(n => n.trackId))]
  const tracks = createDefaultTrackProperties(trackIds.map(trackId => {
    const info = midi.tracks.find(t => t.trackId === trackId)
    return {
      trackId,
      instrumentProgram: info?.instrumentProgram,
      percussion: Boolean(info?.isPercussion || info?.channel === 9),
    }
  }))

  durationUs = pulseToMicroseconds(midi.durationPulse, midi.header.ticksPerQuarter, buildTempoMap(midi))
  duration.value = durationUs / 1_000_000

  session = createPlaySession(notes, controlChanges, tracks, { speed: 100, leadInDuration: 0, zoomPercent: 100, octaveShift: 0 })
  session.mode = 'listen'
  session.modeConfig = PLAY_MODE_CONFIGS.listen
  session.handSelection = 'both'
  session.setupComplete = true
  session.paused = false
  session.tracks.forEach(track => { track.mode = 'playedAutomatically' })

  const freshPlayer = new AutoNotePlayer()
  await freshPlayer.configure('')
  activePlayer = freshPlayer

  clock = new MidiPlayerClock(durationUs, () => 100, state => {
    const s = session
    if (!s) return
    s.currentUs = state.currentUs
    s.finished = state.finished
    s.paused = !state.running
    currentTime.value = Math.max(0, state.currentUs) / 1_000_000
    seekPercent.value = durationUs > 0 ? (state.currentUs / durationUs) * 100 : 0
    freshPlayer.tick(s)
    if (state.finished) {
      clock?.stop()
      clock = null
      playing.value = false
      paused.value = false
    }
  }, { leadInUs: 0 })

  clock.seek(0)
  clock.start()
  playing.value = true
  paused.value = false
}

function pausePlayback() {
  clock?.pause()
  activePlayer?.allNotesOff(null)
  playing.value = false
  paused.value = true
}

function resumePlayback() {
  clock?.start()
  playing.value = true
  paused.value = false
}

function seekTo(e: MouseEvent) {
  if (!clock || durationUs <= 0) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))

  activePlayer?.allNotesOff(null)
  const targetUs = pct * durationUs
  clock.seek(targetUs)
  if (!playing.value && !paused.value) {
    clock.start()
    playing.value = true
    paused.value = false
  }
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

watch(() => props.midiBlob, () => {
  stopPlayback()
})

onBeforeUnmount(() => {
  stopPlayback()
})

defineExpose({ stopPlayback })

function seekBack() {
  if (!clock || durationUs <= 0) return
  const currentUs = Math.max(0, (playing.value || paused.value) ? currentTime.value * 1_000_000 : 0)
  const targetUs = Math.max(0, currentUs - 10_000_000)
  activePlayer?.allNotesOff(null)
  clock.seek(targetUs)
}

function seekForward() {
  if (!clock || durationUs <= 0) return
  const currentUs = Math.max(0, (playing.value || paused.value) ? currentTime.value * 1_000_000 : 0)
  const targetUs = Math.min(durationUs, currentUs + 10_000_000)
  activePlayer?.allNotesOff(null)
  clock.seek(targetUs)
}

function rewindToStart() {
  if (!clock || durationUs <= 0) return
  activePlayer?.allNotesOff(null)
  clock.seek(0)
}

function setVolume(e: Event) {
  volume.value = parseFloat((e.target as HTMLInputElement).value)
  // ponytail: AutoNotePlayer owns its synth privately; cast to reach master volume.
  ;(activePlayer as unknown as { synth?: { setMasterVolume: (v: number) => void } } | null)?.synth?.setMasterVolume(volume.value)
}
</script>

<template>
  <div class="mp-root">
    <div class="mp-progress-bar" role="slider" tabindex="0" @click="seekTo">
      <div class="mp-progress-fill" :style="{ width: seekPercent + '%' }" />
    </div>
    <div class="mp-ctrl-row">
      <div class="mp-left">
        <!-- play / pause toggle -->
        <BaseButton
          v-if="!playing && !paused"
          variant="icon" size="sm"
          :disabled="fetching || loading"
          @click="parseAndPlay"
        ><i :class="fetching ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-play'" /></BaseButton>
        <BaseButton v-else-if="paused" variant="icon" size="sm" @click="resumePlayback"><i class="fa-solid fa-play" /></BaseButton>
        <BaseButton v-else variant="icon" size="sm" @click="pausePlayback"><i class="fa-solid fa-pause" /></BaseButton>

        <!-- rewind to start -->
        <BaseButton variant="icon" size="sm" :disabled="!playing && !paused" @click="rewindToStart"><i class="fa-solid fa-backward-step" /></BaseButton>
        <!-- skip -10s / +10s -->
        <BaseButton variant="icon" size="sm" :disabled="!playing && !paused" @click="seekBack"><i class="fa-solid fa-backward" /></BaseButton>
        <BaseButton variant="icon" size="sm" :disabled="!playing && !paused" @click="seekForward"><i class="fa-solid fa-forward" /></BaseButton>

        <!-- time counter -->
        <span class="mp-time">{{ formatTime(currentTime) }}</span>
        <span class="mp-time-sep">/</span>
        <span class="mp-time">{{ formatTime(duration) }}</span>

        <!-- volume -->
        <div class="mp-vol">
          <i class="fa-solid fa-volume-high mp-vol-icon" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="volume"
            class="mp-vol-slider"
            @input="setVolume"
          />
        </div>
      </div>
      <div class="mp-right">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mp-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mp-progress-bar {
  height: 6px;
  background: var(--color-bg-secondary);
  border-radius: 3px;
  cursor: pointer;
}

.mp-progress-fill {
  height: 100%;
  background: var(--color-accent-amber);
  border-radius: 3px;
  transition: width 0.1s linear;
}

.mp-ctrl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mp-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mp-time {
  font-size: 0.82rem;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: center;
}

.mp-time-sep {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.mp-vol {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mp-vol-icon {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.mp-vol-slider {
  width: 80px;
  height: 4px;
  accent-color: var(--color-accent-amber);
  cursor: pointer;
}

.mp-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 650px) {
  .mp-ctrl-row {
    flex-wrap: wrap;
  }
  .mp-left {
    flex: 1;
  }
}
</style>
