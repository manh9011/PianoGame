<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive } from 'vue'
import Toast from './components/Toast.vue'
import { RouterView } from 'vue-router'
import { Analytics } from "@vercel/analytics/vue"

const MIN_DESIGN_WIDTH = 1280
const MIN_DESIGN_HEIGHT = 720
const VIEWPORT_SCALE_EVENT = 'pianogame:viewport-scale-change'

const viewportScale = reactive({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  viewportWidth: MIN_DESIGN_WIDTH,
  viewportHeight: MIN_DESIGN_HEIGHT,
  stageWidth: MIN_DESIGN_WIDTH,
  stageHeight: MIN_DESIGN_HEIGHT,
})

const stageStyle = computed(() => ({
  width: `${viewportScale.stageWidth}px`,
  height: `${viewportScale.stageHeight}px`,
  transform: `translate(${viewportScale.offsetX}px, ${viewportScale.offsetY}px) scale(${viewportScale.scale})`,
  '--app-design-width': `${viewportScale.stageWidth}px`,
  '--app-design-height': `${viewportScale.stageHeight}px`,
  '--app-viewport-scale': `${viewportScale.scale}`,
}))

let scaleFrameId = 0

function dispatchViewportScaleChange() {
  window.dispatchEvent(new CustomEvent(VIEWPORT_SCALE_EVENT, {
    detail: {
      scale: viewportScale.scale,
      offsetX: viewportScale.offsetX,
      offsetY: viewportScale.offsetY,
      viewportWidth: viewportScale.viewportWidth,
      viewportHeight: viewportScale.viewportHeight,
      designWidth: viewportScale.stageWidth,
      designHeight: viewportScale.stageHeight,
    },
  }))
}

function updateViewportScale() {
  const viewportWidth = window.innerWidth || MIN_DESIGN_WIDTH
  const viewportHeight = window.innerHeight || MIN_DESIGN_HEIGHT
  const scale = Math.min(1, viewportWidth / MIN_DESIGN_WIDTH, viewportHeight / MIN_DESIGN_HEIGHT)
  const stageWidth = Math.max(MIN_DESIGN_WIDTH, viewportWidth / scale)
  const stageHeight = Math.max(MIN_DESIGN_HEIGHT, viewportHeight / scale)

  viewportScale.scale = scale
  viewportScale.offsetX = (viewportWidth - stageWidth * scale) / 2
  viewportScale.offsetY = (viewportHeight - stageHeight * scale) / 2
  viewportScale.viewportWidth = viewportWidth
  viewportScale.viewportHeight = viewportHeight
  viewportScale.stageWidth = stageWidth
  viewportScale.stageHeight = stageHeight

  void nextTick(() => dispatchViewportScaleChange())
}

function scheduleViewportScaleUpdate() {
  if (scaleFrameId) cancelAnimationFrame(scaleFrameId)
  scaleFrameId = requestAnimationFrame(() => {
    scaleFrameId = 0
    updateViewportScale()
  })
}

onMounted(() => {
  updateViewportScale()
  window.addEventListener('resize', scheduleViewportScaleUpdate)
  window.addEventListener('orientationchange', scheduleViewportScaleUpdate)
  document.addEventListener('fullscreenchange', scheduleViewportScaleUpdate)
})

onBeforeUnmount(() => {
  if (scaleFrameId) cancelAnimationFrame(scaleFrameId)
  window.removeEventListener('resize', scheduleViewportScaleUpdate)
  window.removeEventListener('orientationchange', scheduleViewportScaleUpdate)
  document.removeEventListener('fullscreenchange', scheduleViewportScaleUpdate)
})
</script>

<template>
  <Analytics />
  <Toast />
  <div class="app-scale-viewport">
    <div class="app-scale-stage" :style="stageStyle">
      <RouterView />
    </div>
  </div>
</template>
