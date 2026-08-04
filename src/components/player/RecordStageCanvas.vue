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
const wrapperRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const frameWidth = ref(0)
const frameHeight = ref(0)
const previewZoom = ref(1)

const currentUs = computed(() => player.session?.currentUs ?? -LEAD_IN_US)
const videoDimensions = computed(() => resolveRecordVideoDimensions(settings.recordVideoSize, settings.recordVideoOrientation))
const previewAspectRatio = computed(() => {
  return videoDimensions.value.width / videoDimensions.value.height
})

const frameStyle = computed(() => ({
  width: frameWidth.value ? `${frameWidth.value * previewZoom.value}px` : '100%',
  height: frameHeight.value ? `${frameHeight.value * previewZoom.value}px` : '100%',
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
const images = ref<RecordRenderImages>({
  background: null,
  logo: null,
  blackKeyRaised: null,
  blackKeyPressed: null,
})

let resizeObserver: ResizeObserver | null = null
let assetLoadToken = 0
let rafId: number | null = null
let pixelRatio = 1

async function loadAssetPreview(type: 'background' | 'logo', assetId: string, token: number) {
  if (!assetId) {
    if (images.value[type]) {
      images.value[type]?.close()
      images.value = { ...images.value, [type]: null }
    }
    return
  }
  
  const blob = await loadRenderAssetBlob(assetId)
  if (token !== assetLoadToken || !blob) return
  
  const bitmap = await createImageBitmap(blob)
  if (token !== assetLoadToken) {
    bitmap.close()
    return
  }

  if (images.value[type]) {
    images.value[type]?.close()
  }
  images.value = { ...images.value, [type]: bitmap }
}

function refreshAssetPreviews() {
  const token = ++assetLoadToken
  void loadAssetPreview('background', settings.recordBackgroundAssetId, token)
  void loadAssetPreview('logo', settings.recordLogoAssetId, token)
}

function updatePreviewLayout() {
  if (!wrapperRef.value || !canvasRef.value) return
  const availableWidth = wrapperRef.value.clientWidth
  const availableHeight = wrapperRef.value.clientHeight
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

function zoomIn() {
  previewZoom.value = Math.min(2, previewZoom.value + 0.25)
}

function zoomOut() {
  previewZoom.value = Math.max(0.5, previewZoom.value - 0.25)
}

function resetZoom() {
  previewZoom.value = 1
}

async function loadBuiltinAsset(path: string) {
  try {
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
    const response = await fetch(`${baseUrl}${path}`)
    if (!response.ok) return null
    const blob = await response.blob()
    return await createImageBitmap(blob)
  } catch {
    return null
  }
}

onMounted(async () => {
  const [raised, pressed] = await Promise.all([
    loadBuiltinAsset('keys/black-key-raised.png'),
    loadBuiltinAsset('keys/black-key-pressed.png')
  ])
  images.value.blackKeyRaised = raised
  images.value.blackKeyPressed = pressed

  refreshAssetPreviews()
  await nextTick()
  updatePreviewLayout()
  if (typeof ResizeObserver !== 'undefined' && wrapperRef.value) {
    resizeObserver = new ResizeObserver(updatePreviewLayout)
    resizeObserver.observe(wrapperRef.value)
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
  if (images.value.background) images.value.background.close()
  if (images.value.logo) images.value.logo.close()
  if (images.value.blackKeyRaised) images.value.blackKeyRaised.close()
  if (images.value.blackKeyPressed) images.value.blackKeyPressed.close()
  images.value = { background: null, logo: null, blackKeyRaised: null, blackKeyPressed: null }
})
</script>

<template>
  <div ref="wrapperRef" class="record-stage-wrapper">
    <section class="record-stage-layout">
      <div class="record-stage-frame" :style="frameStyle">
        <canvas ref="canvasRef" class="record-stage-canvas"></canvas>
      </div>
    </section>

    <div class="preview-fabs">
      <button class="preview-fab" @click="zoomIn" :disabled="previewZoom >= 2" title="Zoom In (Max 200%)">
        <i class="fas fa-search-plus"></i>
      </button>
      <button class="preview-fab" @click="resetZoom" :disabled="previewZoom === 1" title="Fit to Screen">
        <i class="fas fa-compress"></i>
      </button>
      <button class="preview-fab" @click="zoomOut" :disabled="previewZoom <= 0.5" title="Zoom Out (Min 50%)">
        <i class="fas fa-search-minus"></i>
      </button>
      <div class="preview-zoom-label">{{ Math.round(previewZoom * 100) }}%</div>
    </div>
  </div>
</template>

<style scoped>
.record-stage-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.record-stage-layout {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: auto;
  background: #202226;
}

.record-stage-frame {
  margin: auto;
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

.preview-fabs {
  position: absolute;
  right: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 10;
  align-items: center;
}

.preview-fab {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-bg-tooltip, #303030);
  border: 1px solid var(--color-border-default, #444);
  color: var(--color-text-primary, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}

.preview-fab:hover:not(:disabled) {
  background: var(--color-bg-hover, #404040);
  transform: scale(1.05);
}

.preview-fab:active:not(:disabled) {
  transform: scale(0.95);
}

.preview-fab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.preview-zoom-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #fff);
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 8px;
  border-radius: 12px;
  user-select: none;
}
</style>
