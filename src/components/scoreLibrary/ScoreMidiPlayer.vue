<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import BaseButton from '../ui/BaseButton.vue'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'

interface Props {
  midiBlob: Blob | null
  loading: boolean
  userId?: string
  scoreId?: string
}

const props = defineProps<Props>()

const libraryStore = useLibraryStore()
const settings = useSettingsStore()

const volume = ref(1)
const fetching = ref(false)
const starting = ref(false)
const internalBlob = ref<Blob | null>(null)
let playRequestId = 0

const emit = defineEmits<{
  'midiFetched': [blob: Blob]
}>()

const previewKey = computed(() =>
  props.userId && props.scoreId
    ? `score-library:${props.userId}:${props.scoreId}`
    : 'score-library-preview'
)
const isOwnPreview = computed(() => libraryStore.previewSongId === previewKey.value)
const playing = computed(() => isOwnPreview.value && libraryStore.previewRunning)
const paused = computed(() => isOwnPreview.value && !libraryStore.previewRunning && libraryStore.previewClock !== null)
const duration = computed(() => (isOwnPreview.value ? libraryStore.previewDurationUs / 1_000_000 : 0))
const currentTime = computed(() => {
  if (!isOwnPreview.value) return 0
  const maxUs = libraryStore.previewDurationUs
  const clampedUs = maxUs > 0 ? Math.min(libraryStore.previewCurrentUs, maxUs) : libraryStore.previewCurrentUs
  return Math.max(0, clampedUs) / 1_000_000
})
const seekPercent = computed(() => {
  if (!isOwnPreview.value || libraryStore.previewDurationUs <= 0) return 0
  return Math.max(0, Math.min(100, (libraryStore.previewCurrentUs / libraryStore.previewDurationUs) * 100))
})

function stopPlayback() {
  playRequestId++
  fetching.value = false
  starting.value = false
  libraryStore.stopPreview()
}

async function parseAndPlay() {
  const requestId = ++playRequestId
  const blob = props.midiBlob ?? internalBlob.value
  if (!blob) {
    if (!props.userId || !props.scoreId) return
    fetching.value = true
    try {
      const { fetchMidiBlob } = await import('../../modules/scoreLibrary/scoreLibraryApi')
      const fetched = await fetchMidiBlob(props.userId, props.scoreId)
      if (requestId !== playRequestId) return
      internalBlob.value = fetched
      emit('midiFetched', fetched)
    } catch {
      return
    } finally {
      if (requestId === playRequestId) fetching.value = false
    }
  }

  const activeBlob = props.midiBlob ?? internalBlob.value
  if (!activeBlob || requestId !== playRequestId) return

  starting.value = true
  try {
    const buffer = await activeBlob.arrayBuffer()
    if (requestId !== playRequestId) return
    await libraryStore.startPreviewFromBuffer(buffer, {
      songId: previewKey.value,
      outputId: settings.midiOutputId,
      speed: settings.defaultSpeed,
      leadInDuration: settings.leadInDuration,
      zoomPercent: settings.zoomPercent,
      octaveShift: settings.octaveShift,
      volume: volume.value,
    })
  } finally {
    if (requestId === playRequestId) starting.value = false
  }
}

function pausePlayback() {
  if (isOwnPreview.value) libraryStore.pausePreview()
}

function resumePlayback() {
  if (isOwnPreview.value) libraryStore.resumePreview()
}

function seekTo(e: MouseEvent) {
  if (!isOwnPreview.value || libraryStore.previewDurationUs <= 0) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  libraryStore.seekPreviewToUs(pct * libraryStore.previewDurationUs)
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

watch(() => props.midiBlob, (newBlob) => {
  if (newBlob && newBlob === internalBlob.value) return
  stopPlayback()
})

watch([() => props.userId, () => props.scoreId], () => {
  internalBlob.value = null
  stopPlayback()
})

onBeforeUnmount(() => {
  stopPlayback()
})

defineExpose({ stopPlayback })

function seekBack() {
  if (!isOwnPreview.value || libraryStore.previewDurationUs <= 0) return
  libraryStore.seekPreviewToUs(Math.max(0, libraryStore.previewCurrentUs - 10_000_000))
}

function seekForward() {
  if (!isOwnPreview.value || libraryStore.previewDurationUs <= 0) return
  libraryStore.seekPreviewToUs(Math.min(libraryStore.previewDurationUs, libraryStore.previewCurrentUs + 10_000_000))
}

function rewindToStart() {
  if (!isOwnPreview.value || libraryStore.previewDurationUs <= 0) return
  libraryStore.seekPreviewToUs(0)
}

function setVolume(e: Event) {
  volume.value = parseFloat((e.target as HTMLInputElement).value)
  if (isOwnPreview.value) libraryStore.setPreviewVolume(volume.value)
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
          :disabled="fetching || starting || loading"
          @click="parseAndPlay"
        ><i :class="(fetching || starting) ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-play'" /></BaseButton>
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
            max="1.5"
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
