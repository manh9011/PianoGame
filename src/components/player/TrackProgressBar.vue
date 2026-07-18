<script setup lang="ts">
import { computed, nextTick, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { MidiBookmarkSource } from '../../modules/midi/midiTypes'

const { t } = useI18n()
const props = defineProps<{
  loopSetupActive?: boolean
}>()

const player = usePlayerStore()
const settings = useSettingsStore()
const seekBarRef = ref<HTMLElement | null>(null)
const progressCanvasRef = ref<HTMLCanvasElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const hoverPopover = ref({ visible: false, left: 0, timeUs: 0, measure: 1 })
const hoverPopoverLeftPx = ref(0)
const totalUs = computed(() => player.clock?.seekableDurationUs ?? 0)
const loopTotalUs = computed(() => player.session?.loopState.durationUs || totalUs.value)
const measureTicks = computed(() => {
  if (!totalUs.value) return []
  return (player.session?.measureGridUs ?? [])
    .filter(us => us >= 0 && us <= totalUs.value)
    .map(us => ({ us, left: (us / totalUs.value) * 100 }))
})

function bookmarkVisible(source: MidiBookmarkSource | 'user') {
  if (source === 'user') return settings.showMyBookmarks
  if (source === 'metadata') return settings.showMetadataBookmarks
  if (source === 'keySignature') return settings.showKeySignatureBookmarks
  return settings.showMidiMarkers
}

const bookmarkMarkers = computed(() => {
  const total = totalUs.value
  if (!total) return []
  const midiBookmarks = (player.session?.bookmarks ?? [])
    .filter(bookmark => bookmarkVisible(bookmark.source) && bookmark.timeUs >= 0 && bookmark.timeUs <= total)
    .map(bookmark => ({ ...bookmark, left: (bookmark.timeUs / total) * 100 }))
  const userBookmarks = settings.showMyBookmarks
    ? (player.session?.userBookmarks ?? [])
        .filter(bookmark => bookmark.timeUs >= 0 && bookmark.timeUs <= total)
        .map(bookmark => ({
          id: bookmark.id,
          timeUs: bookmark.timeUs,
          source: 'user' as const,
          label: bookmark.label,
          color: '#FFBB32',
          left: (bookmark.timeUs / total) * 100,
        }))
    : []
  return [...midiBookmarks, ...userBookmarks]
})

const loopRegion = computed(() => {
  const loop = player.session?.loopState
  const total = loopTotalUs.value
  if (!loop || !total || !player.loopRegionConfigured) return null
  return {
    left: (loop.startUs / total) * 100,
    width: ((loop.endUs - loop.startUs) / total) * 100,
  }
})

let isDraggingLoop = false
let isSeekingProgress = false
let dragStartUs = 0
let previewStartUs = 0
let previewEndUs = 0
let canvasResizeObserver: ResizeObserver | null = null
const loopPreview = ref<{ left: number; width: number } | null>(null)
const shouldDrawPlayedRegions = computed(() => !!player.session && player.playbackManuallyStopped)
const playedRegions = computed(() => {
  const total = totalUs.value
  if (!shouldDrawPlayedRegions.value || !total) return []

  return (player.session?.score.playedSegments ?? [])
    .map((segment, index) => {
      const startUs = Math.max(0, Math.min(total, segment.startUs))
      const endUs = Math.max(0, Math.min(total, segment.endUs))
      return {
        key: `${startUs}:${endUs}:${index}`,
        left: (startUs / total) * 100,
        width: ((endUs - startUs) / total) * 100,
      }
    })
    .filter(region => region.width > 0)
})

function syncCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  return { width, height }
}

function drawProgressCanvas() {
  const canvas = progressCanvasRef.value
  if (!canvas) return

  const { width, height } = syncCanvasSize(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  const progressWidth = Math.max(0, Math.min(1, player.currentProgress)) * width
  if (progressWidth <= 0) return

  const progressGradient = ctx.createLinearGradient(0, 0, 0, height)
  progressGradient.addColorStop(0, '#20c92c')
  progressGradient.addColorStop(0.4, '#14a823')
  progressGradient.addColorStop(1, '#079018')
  ctx.fillStyle = progressGradient
  ctx.fillRect(0, 0, progressWidth, height)
}

function drawCanvases() {
  drawProgressCanvas()
}

function handleMouseDown(event: MouseEvent) {
  if (!props.loopSetupActive) {
    if (!player.canSeek) return
    player.blockPlaybackOutput()
    isSeekingProgress = true
    seekFromPointer(event)
    window.addEventListener('mousemove', handleSeekMove)
    window.addEventListener('mouseup', handleSeekEnd)
    return
  }
  player.blockPlaybackOutput()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  isDraggingLoop = true
  dragStartUs = ratio * loopTotalUs.value
  previewStartUs = dragStartUs
  previewEndUs = dragStartUs
  loopPreview.value = { left: ratio * 100, width: 0 }
  window.addEventListener('mousemove', handleDragMove)
  window.addEventListener('mouseup', handleDragEnd)
}

function handleSeekMove(event: MouseEvent) {
  if (!isSeekingProgress || !seekBarRef.value) return
  seekFromPointer(event)
}

function handleSeekEnd() {
  if (!isSeekingProgress) return
  isSeekingProgress = false
  player.unblockPlaybackOutput()
  window.removeEventListener('mousemove', handleSeekMove)
  window.removeEventListener('mouseup', handleSeekEnd)
}

function handleDragMove(event: MouseEvent) {
  if (!isDraggingLoop || !seekBarRef.value) return
  const rect = seekBarRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const currentUs = ratio * loopTotalUs.value
  previewStartUs = Math.min(dragStartUs, currentUs)
  previewEndUs = Math.max(dragStartUs, currentUs)
  loopPreview.value = {
    left: (previewStartUs / loopTotalUs.value) * 100,
    width: ((previewEndUs - previewStartUs) / loopTotalUs.value) * 100,
  }
}

function handleDragEnd() {
  if (!isDraggingLoop) return
  isDraggingLoop = false
  loopPreview.value = null
  if (Math.abs(previewEndUs - previewStartUs) > 10000) {
    player.setLoopRegion(previewStartUs, previewEndUs)
  }
  player.unblockPlaybackOutput()
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)
}

onMounted(() => {
  drawCanvases()
  if (typeof ResizeObserver !== 'undefined' && seekBarRef.value) {
    canvasResizeObserver = new ResizeObserver(() => drawCanvases())
    canvasResizeObserver.observe(seekBarRef.value)
  }
})

watch(
  () => [
    player.currentProgress,
    totalUs.value,
  ],
  () => nextTick(drawCanvases),
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (isDraggingLoop || isSeekingProgress) player.unblockPlaybackOutput(true)
  window.removeEventListener('mousemove', handleSeekMove)
  window.removeEventListener('mouseup', handleSeekEnd)
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)
  canvasResizeObserver?.disconnect()
})

function formatTime(microseconds: number): string {
  const totalSeconds = Math.max(0, microseconds) / 1_000_000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const fraction = Math.floor((totalSeconds % 1) * 10)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${fraction}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${fraction}`
}

function measureAt(timeUs: number): number {
  const grid = player.session?.measureGridUs ?? []
  let low = 0
  let high = grid.length

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (grid[mid] <= timeUs) low = mid + 1
    else high = mid
  }

  return Math.max(1, low)
}

function clampPopoverPosition(anchorX: number) {
  const seekBar = seekBarRef.value
  const popover = popoverRef.value
  if (!seekBar || !popover) return

  const margin = 10
  const rect = seekBar.getBoundingClientRect()
  const popoverWidth = popover.offsetWidth
  const minLeft = margin - rect.left
  const maxLeft = window.innerWidth - margin - rect.left - popoverWidth
  const centeredLeft = anchorX - popoverWidth / 2
  hoverPopoverLeftPx.value = Math.max(minLeft, Math.min(maxLeft, centeredLeft))
}

function updateHoverPopover(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const timeUs = ratio * totalUs.value
  hoverPopover.value = {
    visible: true,
    left: ratio * 100,
    timeUs,
    measure: measureAt(timeUs),
  }
  hoverPopoverLeftPx.value = ratio * rect.width
  nextTick(() => clampPopoverPosition(ratio * rect.width))
}

function hideHoverPopover() {
  hoverPopover.value.visible = false
}

function formatPopoverTime(microseconds: number): string {
  const totalSeconds = Math.max(0, microseconds) / 1_000_000
  if (totalSeconds < 60) return totalSeconds.toFixed(1)
  return formatTime(microseconds)
}

const hoverTime = computed(() => formatPopoverTime(hoverPopover.value.timeUs))

const currentTime = computed(() => {
  const currentUs = player.session?.currentUs ?? 0
  return formatTime(currentUs)
})

const totalTime = computed(() => {
  const totalUs = player.clock?.seekableDurationUs ?? 0
  return formatTime(totalUs)
})

function seekFromPointer(event: MouseEvent) {
  if (!player.canSeek) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  player.seekToProgress(ratio)
}
</script>

<template>
  <section v-if="player.session" class="track-progress">
    <div
      ref="seekBarRef"
      class="seek-bar"
      :class="{ disabled: !player.canSeek && !loopSetupActive, 'loop-mode': loopSetupActive }"
      @mousedown="handleMouseDown"
      @mousemove="updateHoverPopover"
      @mouseleave="hideHoverPopover"
    >
      <canvas ref="progressCanvasRef" class="progress-canvas" />
      <div
        v-for="region in playedRegions"
        :key="region.key"
        class="played-region"
        :style="{ left: `${region.left}%`, width: `${region.width}%` }"
      />
      <div v-for="tick in measureTicks" :key="tick.us" class="measure-tick" :style="{ left: `${tick.left}%` }" />
      <div
        v-if="loopRegion"
        class="loop-region"
        :style="{ left: `${loopRegion.left}%`, width: `${loopRegion.width}%` }"
      />
      <div
        v-if="loopPreview"
        class="loop-preview"
        :style="{ left: `${loopPreview.left}%`, width: `${loopPreview.width}%` }"
      />
      <div
        v-for="bookmark in bookmarkMarkers"
        :key="bookmark.id"
        class="bookmark-marker"
        :class="bookmark.source"
        :style="{ left: `${bookmark.left}%`, '--bookmark-color': bookmark.color }"
        :title="bookmark.label"
      />
      <div
        v-if="hoverPopover.visible"
        ref="popoverRef"
        class="hover-popover"
        :style="{ left: `${hoverPopoverLeftPx}px` }"
      >
        <span>{{ t('progress.time') }} <strong>{{ hoverTime }}</strong></span>
        <span>{{ t('progress.measure') }} <strong>{{ hoverPopover.measure }}</strong></span>
      </div>
      <div class="time-display">
        <span class="time-left">{{ currentTime }}</span>
        <span class="time-right">{{ totalTime }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.track-progress {
  position: relative;
  z-index: 2;
  width: 100%;
  margin: 0;
  padding: 0;
  background: #10151b;
}
.seek-bar {
  position: relative;
  height: 35px;
  overflow: visible;
  border: none;
  border-radius: 0;
  background: linear-gradient(180deg, #3a3a3a 0%, #2b2b2b 38%, #242424 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.68);
  cursor: pointer;
}
.seek-bar::before {
  content: '';
  position: absolute;
  z-index: 3;
  top: 0;
  left: 0;
  right: 0;
  height: 52%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.05) 100%);
  pointer-events: none;
  clip-path: inset(0 0 0 0);
}
.seek-bar.disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.progress-canvas {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.played-region {
  position: absolute;
  z-index: 4;
  bottom: 0;
  height: 7px;
  background: #fbbf24;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.42);
  pointer-events: none;
}
.measure-tick {
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-1px);
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0.16) 42%, rgba(255, 255, 255, 0) 88%) left top / 1px 100% no-repeat,
    linear-gradient(180deg, rgba(0, 0, 0, 0.38) 0%, rgba(0, 0, 0, 0.18) 46%, rgba(0, 0, 0, 0) 90%) right top / 1px 100% no-repeat;
  pointer-events: none;
}
.bookmark-marker {
  --bookmark-color: #FF7F00;
  position: absolute;
  z-index: 3;
  bottom: 0;
  width: 12px;
  height: 13px;
  transform: translateX(-50%);
  background: var(--bookmark-color);
  clip-path: polygon(50% 0, 0 100%, 100% 100%);
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--bookmark-color) 72%, transparent));
  pointer-events: none;
}
.bookmark-marker::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 6px;
  width: 3px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,0.72);
  opacity: 0.5;
}
.loop-region {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  background: rgba(251, 191, 36, 0.12);
  border-left: 2px solid #fbbf24;
  border-right: 2px solid #fbbf24;
  pointer-events: none;
}
.loop-preview {
  position: absolute;
  z-index: 6;
  top: 0;
  bottom: 0;
  background: rgba(251, 191, 36, 0.25);
  border-left: 2px dashed #fbbf24;
  border-right: 2px dashed #fbbf24;
  pointer-events: none;
}
.seek-bar.loop-mode {
  cursor: crosshair;
}
.hover-popover {
  position: absolute;
  z-index: 8;
  top: -43px;
  min-width: 150px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(18, 21, 24, 0.8);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.38);
  color: rgba(255, 255, 255, 0.94);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}
.hover-popover strong {
  color: #8df172;
  font-weight: 700;
}
.time-display {
  position: absolute;
  z-index: 5;
  bottom: 2px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 8px;
  pointer-events: none;
  font-size: 11px;
  font-weight: 700;
  color: rgba(245, 250, 255, 0.94);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 8px rgba(3, 15, 28, 0.85);
}
.time-left {
  text-align: left;
}
.time-right {
  text-align: right;
}
</style>
