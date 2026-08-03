<script setup lang="ts">
import { computed, nextTick, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFreePlayStore, getFreePlayMeasureUs } from '../../stores/freePlayStore'

const { t } = useI18n()
const freePlay = useFreePlayStore()
const seekBarRef = ref<HTMLElement | null>(null)
const progressCanvasRef = ref<HTMLCanvasElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)

const hoverPopover = ref({ visible: false, left: 0, timeUs: 0 })
const hoverPopoverLeftPx = ref(0)
let isSeekingProgress = false
let canvasResizeObserver: ResizeObserver | null = null

const totalUs = computed(() => freePlay.recordingDurationUs)
const currentUs = computed(() => {
  if (freePlay.status === 'recording') {
    return freePlay.recordingDurationUs
  }
  return freePlay.viewUs ?? freePlay.recordingDurationUs
})

const measureUs = computed(() => getFreePlayMeasureUs(freePlay.bpm, freePlay.timeSignature))

const measureTicks = computed(() => {
  if (totalUs.value <= 0 || !measureUs.value) return []
  const ticks = []
  for (let t = 0; t <= totalUs.value; t += measureUs.value) {
    ticks.push({ us: t, left: (t / totalUs.value) * 100 })
  }
  return ticks
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

  if (totalUs.value <= 0) return
  const progressWidth = Math.max(0, Math.min(1, currentUs.value / totalUs.value)) * width
  if (progressWidth <= 0) return

  const progressGradient = ctx.createLinearGradient(0, 0, 0, height)
  progressGradient.addColorStop(0, '#20c92c')
  progressGradient.addColorStop(0.4, '#14a823')
  progressGradient.addColorStop(1, '#079018')
  ctx.fillStyle = progressGradient
  ctx.fillRect(0, 0, progressWidth, height)
}

function clientXToTimeUs(clientX: number) {
  const seekBar = seekBarRef.value
  if (!seekBar || totalUs.value <= 0) return 0
  const rect = seekBar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  return ratio * totalUs.value
}

function handleMouseDown(event: MouseEvent) {
  if (freePlay.status === 'recording' || totalUs.value <= 0) return
  isSeekingProgress = true
  seekFromPointer(event)
  window.addEventListener('mousemove', handleSeekMove)
  window.addEventListener('mouseup', handleSeekEnd)
}

function handleSeekMove(event: MouseEvent) {
  if (!isSeekingProgress) return
  seekFromPointer(event)
}

function handleSeekEnd() {
  if (!isSeekingProgress) return
  isSeekingProgress = false
  window.removeEventListener('mousemove', handleSeekMove)
  window.removeEventListener('mouseup', handleSeekEnd)
}

function seekFromPointer(event: MouseEvent) {
  const timeUs = clientXToTimeUs(event.clientX)
  freePlay.seekTo(timeUs)
}

function formatTime(microseconds: number): string {
  const sign = microseconds < 0 ? '-' : ''
  const totalSeconds = Math.abs(microseconds) / 1_000_000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const fraction = Math.floor((totalSeconds % 1) * 10)

  if (hours > 0) {
    return `${sign}${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${fraction}`
  }
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}.${fraction}`
}

function updateHoverPopover(event: MouseEvent) {
  if (!seekBarRef.value || totalUs.value <= 0) return
  const rect = seekBarRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const timeUs = ratio * totalUs.value
  hoverPopover.value = {
    visible: true,
    left: ratio * 100,
    timeUs,
  }
  hoverPopoverLeftPx.value = ratio * rect.width
  nextTick(() => clampPopoverPosition(ratio * rect.width))
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

function hideHoverPopover() {
  hoverPopover.value.visible = false
}

const formattedHoverTime = computed(() => formatTime(hoverPopover.value.timeUs))
const formattedCurrentTime = computed(() => formatTime(currentUs.value))
const formattedTotalTime = computed(() => formatTime(totalUs.value))

onMounted(() => {
  drawProgressCanvas()
  if (typeof ResizeObserver !== 'undefined' && seekBarRef.value) {
    canvasResizeObserver = new ResizeObserver(() => drawProgressCanvas())
    canvasResizeObserver.observe(seekBarRef.value)
  }
})

watch(() => [currentUs.value, totalUs.value], () => nextTick(drawProgressCanvas), { flush: 'post' })

onBeforeUnmount(() => {
  isSeekingProgress = false
  window.removeEventListener('mousemove', handleSeekMove)
  window.removeEventListener('mouseup', handleSeekEnd)
  canvasResizeObserver?.disconnect()
})
</script>

<template>
  <section class="free-play-progress">
    <div
      ref="seekBarRef"
      class="seek-bar"
      :class="{ disabled: freePlay.status === 'recording' || totalUs <= 0 }"
      @mousedown="handleMouseDown"
      @mousemove="updateHoverPopover"
      @mouseleave="hideHoverPopover"
    >
      <canvas ref="progressCanvasRef" class="progress-canvas" />
      <div v-for="tick in measureTicks" :key="tick.us" class="measure-tick" :style="{ left: `${tick.left}%` }" />
      <div
        v-if="hoverPopover.visible"
        ref="popoverRef"
        class="hover-popover"
        :style="{ left: `${hoverPopoverLeftPx}px` }"
      >
        <span>{{ t('progress.time') }} <strong>{{ formattedHoverTime }}</strong></span>
      </div>
      <div class="time-display">
        <span class="time-left">{{ formattedCurrentTime }}</span>
        <span class="time-right">{{ formattedTotalTime }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.free-play-progress {
  position: relative;
  z-index: 2;
  width: 100%;
  margin: 0;
  padding: 0;
  background: #10151b;
}
.seek-bar {
  position: relative;
  height: 36px;
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
.hover-popover {
  position: absolute;
  z-index: 8;
  top: -43px;
  min-width: 80px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
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
