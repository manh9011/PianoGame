<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { LEAD_IN_US } from '../../modules/midi/midiPlayerClock'
import { loadRenderAssetBlob } from '../../modules/storage/renderAssetStore'
import { resolveRecordVideoDimensions, createRecordRenderScene } from '../../modules/render/record/recordRenderModel'
import type { RecordRenderVisualOptions, RecordRenderImages } from '../../modules/render/record/recordRenderModel'
import { renderRecordScene } from '../../modules/render/record/recordSceneRenderer'

const player = usePlayerStore()
const settings = useSettingsStore()
const stageRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const frameWidth = ref(0)
const frameHeight = ref(0)

const currentUs = computed(() => player.session?.currentUs ?? -LEAD_IN_US)
const videoDimensions = computed(() => resolveRecordVideoDimensions(settings.recordVideoSize, settings.recordVideoOrientation))
const previewAspectRatio = computed(() => {
  return videoDimensions.value.width / videoDimensions.value.height
})

const frameStyle = computed(() => ({
  width: frameWidth.value ? `${frameWidth.value}px` : '100%',
  height: frameHeight.value ? `${frameHeight.value}px` : '100%',
}))

const exportVisuals = computed<RecordRenderVisualOptions>(() => ({
  showGrid: settings.showGrid,
  showFallingNotes: settings.showFallingNotes,
  showKeyboard: true,
  showKeyLabels: settings.showKeyLabels,
  showNoteLabels: settings.showNoteLabels,
  showFingerHints: settings.showFingerHints,
  showColoredFingerHints: settings.showColoredFingerHints,
  keyLabelMode: settings.showKeyLabels ? settings.keyLabelMode : 'none',
  noteLabelMode: settings.showNoteLabels ? settings.noteLabelMode : 'none',
  keyLabelSize: settings.keyLabelSize,
  noteLabelSize: settings.noteLabelSize,
  orientation: settings.recordVideoOrientation,
  videoSize: settings.recordVideoSize,
  backgroundOpacity: 0.36,
  logoEnabled: !!settings.recordLogoAssetId,
}))

const exportScene = computed(() => player.session ? createRecordRenderScene(player.session, player.song?.title ?? '') : null)
const images = ref<RecordRenderImages>({})

let resizeObserver: ResizeObserver | null = null
let backgroundObjectUrl = ''
let logoObjectUrl = ''
let assetLoadToken = 0
let rafId: number | null = null
let pixelRatio = 1

function revokeAssetUrl(type: 'background' | 'logo') {
  if (type === 'background') {
    if (backgroundObjectUrl) URL.revokeObjectURL(backgroundObjectUrl)
    backgroundObjectUrl = ''
    images.value = { ...images.value, background: undefined }
    return
  }
  if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl)
  logoObjectUrl = ''
  images.value = { ...images.value, logo: undefined }
}

async function loadAssetPreview(type: 'background' | 'logo', assetId: string, token: number) {
  revokeAssetUrl(type)
  if (!assetId) return
  const blob = await loadRenderAssetBlob(assetId)
  if (token !== assetLoadToken || !blob) return
  const url = URL.createObjectURL(blob)
  
  if (type === 'background') backgroundObjectUrl = url
  else logoObjectUrl = url

  const img = new Image()
  img.onload = () => {
    if (token === assetLoadToken) {
      images.value = { ...images.value, [type]: img }
    }
  }
  img.src = url
}

function refreshAssetPreviews() {
  const token = ++assetLoadToken
  void loadAssetPreview('background', settings.recordBackgroundAssetId, token)
  void loadAssetPreview('logo', settings.recordLogoAssetId, token)
}

function updatePreviewLayout() {
  if (!stageRef.value || !canvasRef.value) return
  const availableWidth = stageRef.value.clientWidth
  const availableHeight = stageRef.value.clientHeight
  if (!availableWidth || !availableHeight) return
  const aspectRatio = previewAspectRatio.value
  const byWidthHeight = availableWidth / aspectRatio
  
  if (byWidthHeight <= availableHeight) {
    frameWidth.value = availableWidth
    frameHeight.value = byWidthHeight
  } else {
    frameHeight.value = availableHeight
    frameWidth.value = availableHeight * aspectRatio
  }

  // Set internal canvas resolution to EXACT video dimensions for 1:1 render parity
  canvasRef.value.width = videoDimensions.value.width
  canvasRef.value.height = videoDimensions.value.height
}

function drawFrame() {
  rafId = requestAnimationFrame(drawFrame)
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  const scene = exportScene.value
  if (!canvas || !ctx || !scene) return

  const renderWidth = videoDimensions.value.width
  const renderHeight = videoDimensions.value.height

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, renderWidth, renderHeight)
  
  renderRecordScene({
    ctx,
    width: renderWidth,
    height: renderHeight,
    currentUs: currentUs.value,
    scene,
    visuals: exportVisuals.value,
    images: images.value,
  })
}

onMounted(async () => {
  refreshAssetPreviews()
  await nextTick()
  updatePreviewLayout()
  if (typeof ResizeObserver !== 'undefined' && stageRef.value) {
    resizeObserver = new ResizeObserver(updatePreviewLayout)
    resizeObserver.observe(stageRef.value)
  }
  rafId = requestAnimationFrame(drawFrame)
})

watch(() => [settings.recordBackgroundAssetId, settings.recordLogoAssetId], refreshAssetPreviews)
watch(previewAspectRatio, () => nextTick(updatePreviewLayout))

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  resizeObserver = null
  assetLoadToken += 1
  revokeAssetUrl('background')
  revokeAssetUrl('logo')
})
</script>

<template>
  <section ref="stageRef" class="record-stage-layout">
    <div class="record-stage-frame" :style="frameStyle">
      <canvas ref="canvasRef" class="record-stage-canvas"></canvas>
    </div>
  </section>
</template>

<style scoped>
.record-stage-layout {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: #202226;
  overflow: hidden;
}

.record-stage-frame {
  flex: 0 0 auto;
  position: relative;
  background: #000;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.42);
  overflow: hidden;
}

.record-stage-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
