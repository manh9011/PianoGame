<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FREE_PLAY_KEY_SIGNATURES, getFreePlayTrackLoopDurationUs, parseFreePlayTimeSignature, useFreePlayStore, type FreePlayRecordedNote } from '../../stores/freePlayStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { detectBestChord } from '../../modules/game/chordDetection'
import { createPianoKeys, WHITE_KEY_COUNT } from '../../modules/render/pianoGeometry'
import { getNoteLabel } from '../../modules/render/pianoLabels'
import { drawRollHitLine, ROLL_HIT_LINE_HEIGHT } from '../../modules/render/hitLineRenderer'
import { drawImpactParticlesStatelessWithSprites } from '../../modules/render/impactParticlesRenderer'
import { isNoteInRange } from '../../modules/render/keyboardRange'

const PIANO_ROLL_BACKGROUND = '#303030'
const NOTE_RADIUS = 5
const MIN_NOTE_HEIGHT = 8
const keys = createPianoKeys()
const keyByNoteId = new Map(keys.map(key => [key.noteId, key]))
const { t } = useI18n()

const freePlay = useFreePlayStore()
const player = usePlayerStore()
const settings = useSettingsStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null
let logicalWidth = 0
let logicalHeight = 0
let pixelRatio = 1
let lastFrameMs = 0

const keyboardRange = computed(() => player.session?.keyboardRange ?? null)
const selectedKeySignature = computed(() => FREE_PLAY_KEY_SIGNATURES.find(signature => signature.id === freePlay.keySignature) ?? FREE_PLAY_KEY_SIGNATURES[0])
const currentKeyLabel = computed(() => {
  if (!freePlay.showKeySignature) return ''
  const names = t(selectedKeySignature.value.nameKey).split('/').map(part => part.trim())
  return freePlay.keySignatureMode === 'major' ? names[0] : names[1] ?? names[0]
})

const currentChordName = computed(() => {
  if (!freePlay.showChordName) return ''
  const notes = freePlay.pressedNoteIds
  if (notes.length < 2) return ''
  return detectBestChord(notes, freePlay.keySignature, freePlay.keySignatureMode)
})

interface DrawableNote extends FreePlayRecordedNote {
  active?: boolean
}

function currentUs() {
  if (freePlay.status === 'recording' && freePlay.recordStartMs) {
    return Math.max(0, Math.round((performance.now() - freePlay.recordStartMs) * 1000))
  }
  return freePlay.viewUs ?? freePlay.recordingDurationUs
}

function visibleNotes(nowUs: number, viewStartUs: number): DrawableNote[] {
  const notes: DrawableNote[] = []
  for (const track of freePlay.tracks) {
    if (!track.loop || !track.notes.length) {
      notes.push(...track.notes)
      continue
    }

    const loopDurationUs = getFreePlayTrackLoopDurationUs(track, freePlay.bpm, freePlay.timeSignature)
    if (loopDurationUs <= 0) continue
    const firstLoop = Math.max(0, Math.floor(viewStartUs / loopDurationUs) - 1)
    const lastLoop = Math.floor(nowUs / loopDurationUs) + 1
    for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex += 1) {
      const offsetUs = loopIndex * loopDurationUs
      for (const note of track.notes) {
        notes.push({
          ...note,
          id: loopIndex === 0 ? note.id : `${note.id}:loop:${loopIndex}`,
          startUs: note.startUs + offsetUs,
          endUs: note.endUs + offsetUs,
        })
      }
    }
  }

  const activeNotes: DrawableNote[] = freePlay.activeCaptures.map((capture, index) => ({
    id: `active:${capture.noteId}:${index}:${capture.startUs}`,
    trackId: capture.trackId,
    noteId: capture.noteId,
    startUs: capture.startUs,
    endUs: nowUs,
    velocity: capture.velocity,
    source: capture.source,
    active: true,
  }))
  return [...notes, ...activeNotes]
}

function noteColumn(noteId: number) {
  const unitWidth = logicalWidth / WHITE_KEY_COUNT
  const key = keyByNoteId.get(noteId)
  const fallbackWidth = unitWidth * 0.8
  const inset = key ? Math.min(unitWidth * key.width * 0.08, 2) : 0
  return {
    x: key ? key.x * unitWidth + inset : ((noteId - 21) / 87) * logicalWidth,
    width: Math.max(4, key ? key.width * unitWidth - inset * 2 : fallbackWidth),
  }
}

function rollHeight() {
  return Math.max(1, logicalHeight - ROLL_HIT_LINE_HEIGHT)
}

function yForTime(timeUs: number, viewStartUs: number, windowUs: number) {
  const ratio = (timeUs - viewStartUs) / windowUs
  return ratio * rollHeight()
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  const unitWidth = logicalWidth / WHITE_KEY_COUNT
  ctx.save()
  for (const key of keys) {
    if (key.black) continue
    const pitch = key.noteId % 12
    const isOctaveSeparator = pitch === 0
    const isFiveKeyGroupSeparator = pitch === 5
    if (!isOctaveSeparator && !isFiveKeyGroupSeparator) continue

    const x = Math.round(key.x * unitWidth) + 0.5
    ctx.strokeStyle = isOctaveSeparator ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'
    ctx.lineWidth = isOctaveSeparator ? 1.4 : 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, logicalHeight)
    ctx.stroke()
  }

  const windowUs = Math.max(250_000, (3.25 / (settings.zoomPercent / 100)) * 1_000_000)
  const now = currentUs()
  const viewStart = now - windowUs
  const signature = parseFreePlayTimeSignature(freePlay.timeSignature)
  const quarterBeatUs = 60_000_000 / freePlay.bpm
  const beatUs = quarterBeatUs * (4 / signature.denominator)
  const firstBeat = Math.ceil(viewStart / beatUs) * beatUs
  for (let t = firstBeat; t <= now; t += beatUs) {
    const beatIndex = Math.round(t / beatUs)
    const measureLine = ((beatIndex % signature.numerator) + signature.numerator) % signature.numerator === 0
    const y = Math.round(yForTime(t, viewStart, windowUs)) + 0.5
    ctx.strokeStyle = measureLine ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.13)'
    ctx.lineWidth = measureLine ? 1.4 : 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(logicalWidth, y)
    ctx.stroke()

    if (measureLine) {
      const measureIndex = Math.floor(beatIndex / signature.numerator)
      ctx.save()
      ctx.font = '500 13px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeStyle = 'rgba(0,0,0,0.62)'
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.strokeText(String(measureIndex + 1), 4, y - 4)
      ctx.fillText(String(measureIndex + 1), 4, y - 4)
      ctx.restore()
    }
  }
  ctx.restore()
}

function noteColor(note: DrawableNote) {
  const track = freePlay.tracks.find(track => track.id === note.trackId)
  return track?.color ?? freePlay.selectedTrack.color
}

function drawNoteBody(ctx: CanvasRenderingContext2D, note: DrawableNote, x: number, y: number, width: number, height: number) {
  const color = noteColor(note)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.36)'
  ctx.shadowBlur = 3.2
  ctx.shadowOffsetX = 2.5
  ctx.shadowOffsetY = 3
  roundedRect(ctx, x, y, width, height, NOTE_RADIUS)
  ctx.fillStyle = color
  ctx.fill()
  ctx.shadowColor = 'transparent'

  const bevel = ctx.createLinearGradient(x, y, x, y + height)
  bevel.addColorStop(0, 'rgba(255,255,255,0.35)')
  bevel.addColorStop(0.32, 'rgba(255,255,255,0.08)')
  bevel.addColorStop(1, 'rgba(0,0,0,0.18)')
  roundedRect(ctx, x + 1, y + 1, Math.max(0, width - 2), Math.max(0, height - 2), NOTE_RADIUS - 1)
  ctx.fillStyle = bevel
  ctx.fill()

  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'
  roundedRect(ctx, x, y, width, height, NOTE_RADIUS)
  ctx.stroke()
  ctx.restore()
}

function drawNoteLabel(ctx: CanvasRenderingContext2D, note: DrawableNote, x: number, y: number, width: number, height: number) {
  if (!settings.showNoteLabels) return
  const label = getNoteLabel(settings.noteLabelMode, note.noteId)
  if (!label) return
  const fontSize = 16 + settings.noteLabelSize * 2
  ctx.save()
  ctx.font = `700 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  const labelY = y + Math.min(height / 2, Math.max(12, fontSize * 0.75))
  ctx.strokeText(label, x + width / 2, labelY)
  ctx.fillText(label, x + width / 2, labelY)
  ctx.restore()
}

function drawNotes(ctx: CanvasRenderingContext2D) {
  const windowUs = Math.max(250_000, (3.25 / (settings.zoomPercent / 100)) * 1_000_000)
  const now = currentUs()
  const viewStart = now - windowUs
  const range = keyboardRange.value

  for (const note of visibleNotes(now, viewStart)) {
    if (range && !isNoteInRange(note.noteId, range)) continue
    if (note.endUs < viewStart || note.startUs > now) continue
    const visibleStart = Math.max(note.startUs, viewStart)
    const visibleEnd = Math.min(note.endUs, now)
    const yStart = yForTime(visibleStart, viewStart, windowUs)
    const yEnd = yForTime(visibleEnd, viewStart, windowUs)
    const rawHeight = yEnd - yStart
    const height = Math.max(MIN_NOTE_HEIGHT, rawHeight)
    const column = noteColumn(note.noteId)
    const y = Math.max(0, rawHeight < MIN_NOTE_HEIGHT ? yEnd - height : yStart)
    drawNoteBody(ctx, note, column.x, y, column.width, height)
    drawNoteLabel(ctx, note, column.x, y, column.width, height)
  }
}

function drawEmptyHint(ctx: CanvasRenderingContext2D) {
  if (freePlay.status !== 'idle' || freePlay.notes.length) return
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '700 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(t('freePlay.title'), logicalWidth / 2, logicalHeight / 2)
  ctx.restore()
}

function drawCurrentKey(ctx: CanvasRenderingContext2D) {
  const label = currentKeyLabel.value
  if (!label) return
  const x = 8
  const y = logicalHeight - ROLL_HIT_LINE_HEIGHT - 30

  ctx.save()
  ctx.font = '700 22px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = 'rgba(205,208,214,0.92)'
  ctx.strokeText(label, x, y)
  ctx.fillText(label, x, y)
  ctx.restore()
}

function drawCurrentChord(ctx: CanvasRenderingContext2D) {
  const label = currentChordName.value
  if (!label) return
  const x = logicalWidth / 2
  const y = 16

  ctx.save()
  ctx.font = '700 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  ctx.strokeText(label, x, y)
  ctx.fillText(label, x, y)
  ctx.restore()
}

function draw() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, logicalWidth, logicalHeight)
  ctx.fillStyle = PIANO_ROLL_BACKGROUND
  ctx.fillRect(0, 0, logicalWidth, logicalHeight)
  if (settings.showGrid) drawGrid(ctx)
  drawNotes(ctx)
  drawCurrentChord(ctx)
  drawCurrentKey(ctx)
  drawRollHitLine(ctx, logicalWidth, logicalHeight, freePlay.status !== 'recording')
  const now = currentUs()
  const windowUs = Math.max(250_000, (3.25 / (settings.zoomPercent / 100)) * 1_000_000)
  const viewStart = now - windowUs
  drawImpactParticlesStatelessWithSprites(ctx, visibleNotes(now, viewStart).map(note => {
    const col = noteColumn(note.noteId)
    return {
      id: note.id,
      noteId: note.noteId,
      trackId: note.trackId,
      x: col.x,
      width: col.width,
      startUs: note.startUs,
      endUs: note.endUs,
    }
  }), now, logicalHeight, 0, settings.advancedReduceAnimations)
  drawEmptyHint(ctx)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const nextPixelRatio = window.devicePixelRatio || 1
  logicalWidth = rect.width
  logicalHeight = rect.height
  pixelRatio = nextPixelRatio
  canvas.width = Math.round(rect.width * nextPixelRatio)
  canvas.height = Math.round(rect.height * nextPixelRatio)
  draw()
}

function isAnimating() {
  return freePlay.status === 'recording' || freePlay.isPlaying
}

function animationFrame(timeMs?: number) {
  const now = timeMs ?? performance.now()
  const dt = Math.min(60, Math.max(0, now - lastFrameMs))
  
  if (settings.advancedReduceAnimations && dt < 33.0) {
    if (isAnimating()) rafId = requestAnimationFrame(animationFrame)
    else rafId = null
    return
  }
  lastFrameMs = now

  draw()
  
  if (isAnimating()) {
    rafId = requestAnimationFrame(animationFrame)
  } else {
    rafId = null
  }
}

function requestDraw() {
  if (isAnimating()) {
    if (rafId === null) rafId = requestAnimationFrame(animationFrame)
    return
  }
  if (rafId === null) {
    lastFrameMs = performance.now()
    rafId = requestAnimationFrame(animationFrame)
  }
}

let isDragging = false
let lastDragY = 0

function handleWheel(event: WheelEvent) {
  if (freePlay.status === 'recording') return
  const windowUs = Math.max(250_000, (3.25 / (settings.zoomPercent / 100)) * 1_000_000)
  const usPerPixel = windowUs / rollHeight()
  const deltaUs = event.deltaY * usPerPixel
  const current = currentUs()
  const nextUs = Math.max(0, current + deltaUs)
  freePlay.seekTo(nextUs)
}

function handlePointerDown(event: PointerEvent) {
  if (freePlay.status === 'recording') return
  isDragging = true
  lastDragY = event.clientY
  const canvas = canvasRef.value
  if (canvas) canvas.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging || freePlay.status === 'recording') return
  const windowUs = Math.max(250_000, (3.25 / (settings.zoomPercent / 100)) * 1_000_000)
  const usPerPixel = windowUs / rollHeight()
  const deltaY = event.clientY - lastDragY
  lastDragY = event.clientY
  
  const deltaUs = -deltaY * usPerPixel
  const current = currentUs()
  const nextUs = Math.max(0, current + deltaUs)
  freePlay.seekTo(nextUs)
}

function handlePointerUp(event: PointerEvent) {
  isDragging = false
  const canvas = canvasRef.value
  if (canvas && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId)
  }
}

watch(() => [freePlay.status, freePlay.viewUs, freePlay.notes.length, freePlay.clockTick, freePlay.trackVersion, freePlay.selectedTrackId, freePlay.bpm, freePlay.timeSignature, freePlay.keySignature, freePlay.keySignatureMode, freePlay.showKeySignature, freePlay.showChordName, settings.showGrid, settings.showNoteLabels, settings.noteLabelMode, settings.noteLabelSize, settings.zoomPercent], requestDraw)
watch(() => player.session?.keyboardRange ? `${player.session.keyboardRange.lowNote}:${player.session.keyboardRange.highNote}` : '', requestDraw)

onMounted(() => {
  resizeCanvas()
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(canvasRef.value)
  }
  requestDraw()
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="free-play-roll">
    <canvas 
      ref="canvasRef" 
      class="free-play-roll-canvas"
      @wheel.prevent="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
    ></canvas>
  </div>
</template>

<style scoped>
.free-play-roll {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #303030;
}

.free-play-roll-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
