<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'
import { base64ToBuffer, loadSongData } from '../../modules/library/songLibrary'
import { generateSheetMusic } from '../../modules/sheet/sheetMusicClient'
import { loadVerovio } from '../../modules/sheet/verovioLoader'
import { getSheetTrackIds, getSheetTrackSelectionKey } from '../../modules/game/trackProperties'
import { SheetMusicError, toSheetMusicError } from '../../modules/sheet/sheetTypes'
import type { SheetErrorCode, SheetGenerationProgress, SheetMessageValues, SheetMusicArtifact } from '../../modules/sheet/sheetTypes'

const emit = defineEmits<{
  ready: []
}>()

const { t } = useI18n()
const player = usePlayerStore()
const viewportRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const measureHighlightRef = ref<HTMLElement | null>(null)
const svgMarkup = ref('')
const status = ref<SheetGenerationProgress>({ stage: 'idle', message: 'sheetMusic.progress.preparing', code: 'preparing' })
const errorCode = ref<SheetErrorCode | null>(null)
const errorValues = ref<SheetMessageValues>({})
const errorFallback = ref('')
const artifact = ref<SheetMusicArtifact | null>(null)
const panelHeight = ref(128)
const hasError = computed(() => !!errorCode.value || !!errorFallback.value)
const loading = computed(() => !hasError.value && status.value.stage !== 'ready')
const includedSheetTrackIds = computed(() => getSheetTrackIds(player.session?.tracks ?? []))
const sheetTrackSignature = computed(() => getSheetTrackSelectionKey(player.session?.tracks ?? []))
const statusMessage = computed(() => status.value.code ? t(`sheetMusic.progress.${status.value.code}`, status.value.values ?? {}) : status.value.message)
const errorMessage = computed(() => errorCode.value ? t(`sheetMusic.errors.${errorCode.value}`, errorValues.value) : errorFallback.value)

let toolkit: Awaited<ReturnType<typeof loadVerovio>>['toolkit']['prototype'] | null = null
let requestToken = 0
let animationFrame = 0
let activeNoteIds: string[] = []
let currentMeasureElement: Element | null = null
let scoreSvgElement: SVGSVGElement | null = null
let scoreContentWidth = 0
let currentPlayheadX = 0
let lastAnchorOnsetMs = -Infinity
let lastPlaybackUs = 0
let resizeObserver: ResizeObserver | null = null

function clearHighlights() {
  for (const id of activeNoteIds) {
    const element = document.getElementById(id)
    element?.classList.remove('sheet-playing-note')
  }
  activeNoteIds = []
}

function findMeasureElement(element: Element) {
  let node: Element | null = element
  while (node && node !== scoreSvgElement) {
    if (node.classList?.contains('measure')) return node
    node = node.parentElement
  }
  return null
}

function updateMeasureHighlight(measureElement: Element, stageRect: DOMRect) {
  const highlight = measureHighlightRef.value
  if (!highlight || !scoreSvgElement || measureElement === currentMeasureElement) return

  currentMeasureElement = measureElement
  const rect = measureElement.getBoundingClientRect()
  highlight.style.transform = `translateX(${rect.left - stageRect.left}px)`
  highlight.style.top = '0px'
  highlight.style.width = `${rect.width}px`
  highlight.style.height = `${stageRect.height}px`
  highlight.style.opacity = '1'
}

function resetFollowState() {
  currentPlayheadX = 0
  lastAnchorOnsetMs = -Infinity
  currentMeasureElement = null
  clearHighlights()
  if (measureHighlightRef.value) measureHighlightRef.value.style.opacity = '0'
}

function hideMeasureHighlight() {
  currentMeasureElement = null
  if (measureHighlightRef.value) measureHighlightRef.value.style.opacity = '0'
}

function updatePlaybackWindow() {
  if (!toolkit || !stageRef.value || !scoreSvgElement) return
  const currentUs = player.session?.currentUs ?? Number.NEGATIVE_INFINITY

  if (!Number.isFinite(currentUs) || currentUs < 0) {
    lastPlaybackUs = currentUs
    resetFollowState()
    return
  }

  if (currentUs < lastPlaybackUs - 50_000) resetFollowState()
  lastPlaybackUs = currentUs

  const currentMs = Math.round(currentUs / 1000)
  const currentElements = toolkit.getElementsAtTime(currentMs)
  clearHighlights()
  if (!currentElements || currentElements.page === 0 || !currentElements.notes?.length) {
    hideMeasureHighlight()
    return
  }

  const onsetToleranceMs = 3
  const timedElements: Array<{ id: string; element: Element; onset: number }> = []
  for (const id of currentElements.notes) {
    const element = document.getElementById(id)
    if (!element) continue

    let onset = -1
    try {
      onset = Number(toolkit.getTimeForElement(id))
    } catch {
      onset = -1
    }
    if (!Number.isFinite(onset) || onset < 0 || onset > currentMs + onsetToleranceMs) continue

    timedElements.push({ id, element, onset })
    element.classList.add('sheet-playing-note')
    activeNoteIds.push(id)
  }

  const validOnsets = timedElements.map(item => item.onset)
  if (!validOnsets.length) {
    hideMeasureHighlight()
    return
  }

  const latestOnset = Math.max(...validOnsets)
  if (latestOnset + onsetToleranceMs < lastAnchorOnsetMs) return

  const anchorItems = timedElements.filter(item => item.onset >= 0 && Math.abs(item.onset - latestOnset) <= onsetToleranceMs)
  if (!anchorItems.length) return

  const stageRect = stageRef.value.getBoundingClientRect()
  const noteRects = anchorItems.map(item => item.element.getBoundingClientRect())
  const left = Math.min(...noteRects.map(rect => rect.left))
  const right = Math.max(...noteRects.map(rect => rect.right))
  const candidateX = (left + right) / 2 - stageRect.left

  if (latestOnset > lastAnchorOnsetMs + onsetToleranceMs) {
    lastAnchorOnsetMs = latestOnset
    currentPlayheadX = Math.max(currentPlayheadX, candidateX)
  } else {
    currentPlayheadX = Math.max(currentPlayheadX, candidateX)
  }

  const measureElement = findMeasureElement(anchorItems[0].element)
  if (measureElement) updateMeasureHighlight(measureElement, stageRect)
}

function updatePanelHeight() {
  const svgHeight = scoreSvgElement?.getBoundingClientRect().height ?? 0
  if (!svgHeight) return
  const maxHeight = Math.max(128, Math.floor(window.innerHeight * 0.42))
  panelHeight.value = Math.min(maxHeight, Math.max(128, Math.ceil(svgHeight + 20)))
}

function updateSheetFollow(force = false) {
  const viewport = viewportRef.value
  if (!viewport || !scoreSvgElement) return

  const contentWidth = Math.max(scoreContentWidth, viewport.scrollWidth, scoreSvgElement.getBoundingClientRect().width)
  if (contentWidth <= viewport.clientWidth) {
    viewport.scrollLeft = 0
    return
  }

  const anchorX = viewport.clientWidth * 0.35
  const maxScrollLeft = contentWidth - viewport.clientWidth
  const targetScrollLeft = Math.min(maxScrollLeft, Math.max(0, currentPlayheadX - anchorX))
  if (force) viewport.scrollLeft = targetScrollLeft
  else viewport.scrollLeft += (targetScrollLeft - viewport.scrollLeft) * 0.18
}

function playbackLoop() {
  updatePlaybackWindow()
  updateSheetFollow()
  animationFrame = requestAnimationFrame(playbackLoop)
}

function startPlaybackLoop() {
  if (!animationFrame) animationFrame = requestAnimationFrame(playbackLoop)
}

function stopPlaybackLoop() {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

async function renderArtifact(nextArtifact: SheetMusicArtifact, token: number) {
  status.value = { stage: 'rendering', message: 'sheetMusic.progress.renderingVerovio', code: 'renderingVerovio' }
  const verovio = await loadVerovio()
  if (token !== requestToken) return

  toolkit = new verovio.toolkit()
  toolkit.setOptions({
    pageHeight: 800,
    pageWidth: 60000,
    scale: 45,
    breaks: 'none',
    header: 'none',
    footer: 'none',
    adjustPageHeight: true,
    pageMarginTop: 10,
    pageMarginBottom: 10,
    pageMarginLeft: 100,
    pageMarginRight: 100,
  })
  toolkit.loadData(nextArtifact.musicXml)
  toolkit.renderToMIDI()
  svgMarkup.value = toolkit.renderToSVG(1, {})
  artifact.value = nextArtifact
  status.value = { stage: 'ready', message: 'sheetMusic.progress.ready', code: 'ready' }

  await nextTick()
  if (token !== requestToken) return
  scoreSvgElement = stageRef.value?.querySelector('svg') ?? null
  if (scoreSvgElement) {
    scoreSvgElement.style.display = 'block'
    scoreSvgElement.style.maxWidth = 'none'
    scoreSvgElement.style.height = 'auto'
  }

  requestAnimationFrame(() => {
    if (token !== requestToken) return
    scoreContentWidth = scoreSvgElement?.getBoundingClientRect().width ?? 0
    updatePanelHeight()
    resetFollowState()
    updatePlaybackWindow()
    updateSheetFollow(true)
    emit('ready')
  })
}

async function loadSheet() {
  const song = player.song
  if (!song) return
  const token = ++requestToken
  errorCode.value = null
  errorValues.value = {}
  errorFallback.value = ''
  svgMarkup.value = ''
  artifact.value = null
  toolkit = null
  resetFollowState()
  status.value = { stage: 'building-model', message: 'sheetMusic.progress.loadingMidiData', code: 'loadingMidiData' }

  try {
    const data = song.data ?? await loadSongData(song.id)
    if (!data) throw new SheetMusicError('sheetMusic.errors.missingMidiData', 'missingMidiData')
    const includedTrackIds = includedSheetTrackIds.value
    const cacheKey = `${song.hash}:sheet-v20:tracks=${sheetTrackSignature.value || 'none'}`
    const generated = await generateSheetMusic(cacheKey, base64ToBuffer(data), progress => {
      if (token === requestToken) status.value = progress
    }, { includedTrackIds })
    if (token !== requestToken) return
    await renderArtifact(generated, token)
  } catch (error) {
    if (token !== requestToken) return
    const sheetError = toSheetMusicError(error)
    errorCode.value = sheetError.code
    errorValues.value = sheetError.values
    errorFallback.value = sheetError.message
    status.value = { stage: 'error', message: sheetError.message }
  }
}

watch(() => [player.song?.hash, sheetTrackSignature.value], () => {
  void loadSheet()
}, { immediate: true })

watch(() => player.session?.currentUs ?? 0, (currentUs, previousUs) => {
  if (currentUs < previousUs - 50_000) resetFollowState()
})

watch(svgMarkup, () => {
  resizeObserver?.disconnect()
  nextTick(() => {
    if (!viewportRef.value) return
    resizeObserver = new ResizeObserver(() => {
      scoreContentWidth = scoreSvgElement?.getBoundingClientRect().width ?? 0
      updatePanelHeight()
      updatePlaybackWindow()
      updateSheetFollow(true)
    })
    resizeObserver.observe(viewportRef.value)
  })
})

startPlaybackLoop()

onBeforeUnmount(() => {
  requestToken++
  stopPlaybackLoop()
  resizeObserver?.disconnect()
  clearHighlights()
})
</script>

<template>
  <section class="sheet-panel" :style="{ height: `${panelHeight}px` }" :aria-label="t('sheetMusic.aria')">
    <div ref="viewportRef" class="sheet-viewport">
      <div v-if="loading" class="sheet-message">
        <span class="spinner" />
        <span>{{ statusMessage }}</span>
      </div>
      <div v-else-if="errorMessage" class="sheet-message error">
        <span>{{ t('sheetMusic.errorDisplay', { message: errorMessage }) }}</span>
        <button type="button" @click="loadSheet">{{ t('sheetMusic.retry') }}</button>
      </div>
      <div v-else ref="stageRef" class="sheet-stage" dir="ltr">
        <div v-html="svgMarkup" />
        <div ref="measureHighlightRef" class="measure-highlight" aria-hidden="true" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.sheet-panel {
  position: relative;
  z-index: 1;
  min-height: 128px;
  max-height: 42vh;
  background: #f8fafc;
  border-bottom: 1px solid rgba(15, 23, 42, 0.28);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.sheet-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  direction: ltr;
  scrollbar-width: none;
  -ms-overflow-style: none;
  white-space: nowrap;
}

.sheet-viewport::-webkit-scrollbar {
  display: none;
}

.sheet-stage {
  position: relative;
  display: inline-block;
  min-height: 100%;
  line-height: 0;
  vertical-align: top;
  isolation: isolate;
}

.sheet-stage :deep(svg) {
  position: relative;
  z-index: 10;
  display: block;
  max-width: none;
  height: auto;
}

.measure-highlight {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  background: rgba(78, 183, 235, 0.22);
  border-left: 1px solid rgba(20, 139, 199, 0.25);
  border-right: 1px solid rgba(20, 139, 199, 0.2);
  will-change: transform, width, height;
}

.sheet-stage :deep(.sheet-playing-note),
.sheet-stage :deep(.sheet-playing-note *) {
  fill: #0b84d8 !important;
  stroke: #0b84d8 !important;
}

.sheet-stage :deep(.tempo),
.sheet-stage :deep(.tempo *) {
  display: none !important;
}

.sheet-message {
  height: 100%;
  min-height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.sheet-message.error {
  color: #991b1b;
}

.sheet-message button {
  border: 1px solid rgba(153, 27, 27, 0.25);
  border-radius: 6px;
  background: #fff;
  color: #991b1b;
  padding: 6px 10px;
  font-weight: 700;
  cursor: pointer;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(59, 130, 246, 0.18);
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
