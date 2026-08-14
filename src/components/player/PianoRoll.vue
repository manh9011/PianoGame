<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { layoutNotes } from '../../modules/render/pianoRollLayout'
import type { LaidOutNote } from '../../modules/render/pianoRollLayout'
import { createPianoKeys, WHITE_KEY_COUNT } from '../../modules/render/pianoGeometry'
import { formatKeySignature, getNoteLabel, notePitchClass } from '../../modules/render/pianoLabels'
import { FLAT_GRAY, MISSED_NOTE_COLOR, TRACK_INVISIBLE_COLOR } from '../../modules/game/trackProperties'
import { HAND_COLORS, HAND_HIT_COLORS } from '../../modules/game/handAssignment'
import { drawRollHitLine, ROLL_HIT_LINE_HEIGHT as HIT_LINE_HEIGHT } from '../../modules/render/hitLineRenderer'
import { createImpactParticleRenderer, getImpactRepeatThrottleMs, IMPACT_REWIND_THRESHOLD_US } from '../../modules/render/impactParticlesRenderer'
import { addActivePlaybackCounter, addPlaybackCounter, beginRenderFrame, endRenderFrame, measurePlaybackSpan, setPlaybackGauge, type PlaybackProfilerContext } from '../../modules/perf/playbackProfiler'
import type { SessionBookmark, SessionNote, UserBookmark } from '../../modules/game/playSession'
import type { MidiBookmarkSource } from '../../modules/midi/midiTypes'

const props = defineProps<{
  bookmarkMode?: boolean
  benchmarkMode?: boolean
  loopSetupActive?: boolean
  fingerMode?: boolean
  transparentBackground?: boolean
}>()

const emit = defineEmits<{
  selectFingerNote: [note: SessionNote, anchor: { x: number; y: number; width: number; height: number }]
}>()

const USER_BOOKMARK_COLOR = '#FFBB32'
const BOOKMARK_GAP_WIDTH = 24
const PIANO_ROLL_BACKGROUND = '#303030'

const player = usePlayerStore()
const settings = useSettingsStore()
const { t } = useI18n()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null
let logicalWidth = 0
let logicalHeight = 0
let pixelRatio = 1
// Removed CanvasSpriteCache to avoid Safari max canvas context limit crash
let fpsFrames = 0
let fpsLastSampleMs = performance.now()
let lastFps = 0

// Touch scroll state
let touchStartY = 0
let touchStartUs = 0
let isTouchDragging = false
const SCROLL_SENSITIVITY = 2.5 // microseconds per pixel
const pianoKeys = createPianoKeys()
// Loop edge dragging state
const LOOP_EDGE_HIT_ZONE = 12
type LoopDragEdge = 'start' | 'end' | null
let draggingLoopEdge: LoopDragEdge = null

const BOOKMARK_LABEL_MIN_GAP = 18
const activeImpacts = new Map<string, number>()
const impactParticles = createImpactParticleRenderer()
let lastFrameMs = performance.now()
let lastSessionRef: typeof player.session | null = null
let lastCurrentUs = Number.NEGATIVE_INFINITY
const verticalGridLines = [
  { x: 0, octave: true },
  ...pianoKeys
    .filter(key => !key.black && (notePitchClass(key.noteId) === 0 || notePitchClass(key.noteId) === 5))
    .map(key => ({ x: key.x, octave: notePitchClass(key.noteId) === 0 })),
].filter((line, index, lines) => line.x >= 0 && line.x <= WHITE_KEY_COUNT && lines.findIndex(item => item.x === line.x) === index)

const trackRenderMeta = new Map<number, { mode: string; color: string; hitColor: string }>()

function syncTrackRenderMeta(session: NonNullable<typeof player.session>) {
  trackRenderMeta.clear()
  for (const track of session.tracks) {
    trackRenderMeta.set(track.trackId, {
      mode: track.mode,
      color: track.color,
      hitColor: track.hitColor,
    })
  }
}

function color(note: SessionNote) {
  const track = trackRenderMeta.get(note.trackId)
  if (!track) return FLAT_GRAY
  if (note.state === 'missed') return MISSED_NOTE_COLOR
  if (note.state === 'hit') return track.hitColor || HAND_HIT_COLORS[note.hand]
  return track.color || HAND_COLORS[note.hand]
}
function visible(note: SessionNote) {
  const track = trackRenderMeta.get(note.trackId)
  return track?.color !== TRACK_INVISIBLE_COLOR && track?.mode !== 'playedButHidden'
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
function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const nextPixelRatio = window.devicePixelRatio || 1
  const nextWidth = Math.round(rect.width * nextPixelRatio)
  const nextHeight = Math.round(rect.height * nextPixelRatio)
  logicalWidth = rect.width
  logicalHeight = rect.height
  pixelRatio = nextPixelRatio
  if (canvas.width !== nextWidth) canvas.width = nextWidth
  if (canvas.height !== nextHeight) canvas.height = nextHeight
}
function noteKey(note: SessionNote) {
  return `${note.trackId}:${note.noteId}:${note.start}:${note.end}`
}
function clearEffects() {
  impactParticles.clear()
  activeImpacts.clear()
}
function syncEffectSession(session: NonNullable<typeof player.session>) {
  if (session !== lastSessionRef) {
    clearEffects()
    lastSessionRef = session
  } else if (session.currentUs < lastCurrentUs - IMPACT_REWIND_THRESHOLD_US) {
    clearEffects()
  }
  lastCurrentUs = session.currentUs
}
function withAlpha(input: string, alpha: number) {
  const clamped = Math.max(0, Math.min(1, alpha))
  if (/^#[\da-f]{6}$/i.test(input)) {
    const value = Number.parseInt(input.slice(1), 16)
    const red = (value >> 16) & 255
    const green = (value >> 8) & 255
    const blue = value & 255
    return `rgba(${red},${green},${blue},${clamped})`
  }
  if (/^#[\da-f]{3}$/i.test(input)) {
    const red = Number.parseInt(input[1] + input[1], 16)
    const green = Number.parseInt(input[2] + input[2], 16)
    const blue = Number.parseInt(input[3] + input[3], 16)
    return `rgba(${red},${green},${blue},${clamped})`
  }
  return input
}
function parseHexColor(input: string) {
  if (/^#[\da-f]{6}$/i.test(input)) {
    const value = Number.parseInt(input.slice(1), 16)
    return { red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255 }
  }
  if (/^#[\da-f]{3}$/i.test(input)) {
    return {
      red: Number.parseInt(input[1] + input[1], 16),
      green: Number.parseInt(input[2] + input[2], 16),
      blue: Number.parseInt(input[3] + input[3], 16),
    }
  }
  return { red: 0, green: 0, blue: 0 }
}
function labelColors(background: string) {
  const { red, green, blue } = parseHexColor(background)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.48
    ? { fill: '#111827', stroke: 'rgba(255,255,255,0.78)' }
    : { fill: '#ffffff', stroke: 'rgba(0,0,0,0.72)' }
}
function spawnImpact(note: LaidOutNote<SessionNote>) {
  addActivePlaybackCounter('render', 'impactSpawns')
  impactParticles.spawn(note, logicalHeight)
}
function triggerImpacts(notes: LaidOutNote<SessionNote>[], session: NonNullable<typeof player.session>, nowMs: number) {
  const touchingKeys = new Set<string>()
  const canSpawn = !session.paused && !session.finished

  for (const note of notes) {
    if (!visible(note)) continue
    if (session.currentUs < note.start || session.currentUs > note.end) continue

    const key = noteKey(note)
    touchingKeys.add(key)
    if (!canSpawn) continue

    const lastSpawnMs = activeImpacts.get(key)
    const throttleMs = getImpactRepeatThrottleMs(settings.advancedReduceAnimations)
    if (lastSpawnMs !== undefined && nowMs - lastSpawnMs < throttleMs) continue

    activeImpacts.set(key, nowMs)
    spawnImpact(note)
  }

  for (const key of activeImpacts.keys()) {
    if (!touchingKeys.has(key)) activeImpacts.delete(key)
  }
}
function updateEffects(dt: number) {
  impactParticles.update(dt)
}
function drawHitLine(ctx: CanvasRenderingContext2D, isStopped: boolean) {
  drawRollHitLine(ctx, logicalWidth, logicalHeight, isStopped)
}
function bookmarkVisible(source: MidiBookmarkSource | 'user') {
  if (source === 'user') return settings.showMyBookmarks
  if (source === 'metadata') return settings.showMetadataBookmarks
  if (source === 'keySignature') return settings.showKeySignatureBookmarks
  return settings.showMidiMarkers
}
function visibleBookmarks(session: NonNullable<typeof player.session>) {
  let scanned = 0
  const result = session.bookmarks.filter(bookmark => {
    scanned += 1
    return bookmarkVisible(bookmark.source)
  })
  addActivePlaybackCounter('render', 'bookmarksScanned', scanned)
  return result
}
function sessionWindowUs(session: NonNullable<typeof player.session>) {
  return (3.25 / (session.zoomPercent / 100)) * 1_000_000
}
function currentKeySignature(session: NonNullable<typeof player.session>) {
  let current = null
  let scanned = 0
  for (const signature of session.keySignatures) {
    scanned += 1
    if (signature.timeUs > session.currentUs) break
    current = signature
  }
  addActivePlaybackCounter('render', 'keySignatureScanned', scanned)
  return current
}

function currentKeyLabel(session: NonNullable<typeof player.session>) {
  if (!settings.showKeySignatureBookmarks) return ''
  const signature = currentKeySignature(session)
  return formatKeySignature(signature?.key, signature?.scale, t, signature?.label)
}

function currentKeySignatureAccidentals(session: NonNullable<typeof player.session>) {
  return currentKeySignature(session)?.accidentals ?? 0
}
function drawBookmarks(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  const windowUs = sessionWindowUs(session)
  let lastLabelY = Number.NEGATIVE_INFINITY
  let visibleCount = 0
  for (const bookmark of visibleBookmarks(session)) {
    if (bookmark.timeUs < session.currentUs || bookmark.timeUs > session.currentUs + windowUs) continue
    visibleCount += 1
    const y = logicalHeight - ((bookmark.timeUs - session.currentUs) / windowUs) * logicalHeight
    drawBookmarkTick(ctx, bookmark, y)
    if (y > 12 && y < logicalHeight - 10 && Math.abs(y - lastLabelY) >= BOOKMARK_LABEL_MIN_GAP) {
      drawBookmarkLabel(ctx, bookmark, y)
      lastLabelY = y
    }
  }
  addActivePlaybackCounter('render', 'bookmarksVisible', visibleCount)
}
function drawBookmarkTick(ctx: CanvasRenderingContext2D, bookmark: SessionBookmark, y: number) {
  ctx.save()
  ctx.strokeStyle = bookmark.color
  ctx.lineWidth = 4
  ctx.shadowColor = withAlpha(bookmark.color, 0.72)
  ctx.shadowBlur = 7
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(20, y)
  ctx.stroke()

  ctx.fillStyle = bookmark.color
  roundedRect(ctx, 0, y - 4, 18, 8, 2)
  ctx.fill()
  ctx.restore()
}
function drawBookmarkLabel(ctx: CanvasRenderingContext2D, bookmark: SessionBookmark, y: number) {
  let labelText = bookmark.label
  if (bookmark.source === 'keySignature') {
    labelText = formatKeySignature(undefined, undefined, t, bookmark.label)
  }
  const text = labelText.length > 18 ? `${labelText.slice(0, 17)}…` : labelText
  ctx.save()
  ctx.font = '700 18px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = 'rgba(205,208,214,0.92)'
  ctx.strokeText(text, 8, y + 6)
  ctx.fillText(text, 8, y + 6)
  ctx.restore()
}
function drawUserBookmarks(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  if (!settings.showMyBookmarks) return
  const windowUs = sessionWindowUs(session)
  let lastLabelY = Number.NEGATIVE_INFINITY
  let scanned = 0
  let visibleCount = 0
  for (const bookmark of session.userBookmarks) {
    scanned += 1
    if (bookmark.timeUs < session.currentUs || bookmark.timeUs > session.currentUs + windowUs) continue
    visibleCount += 1
    const y = logicalHeight - ((bookmark.timeUs - session.currentUs) / windowUs) * logicalHeight
    drawUserBookmarkTick(ctx, bookmark, y)
    if (y > 12 && y < logicalHeight - 10 && Math.abs(y - lastLabelY) >= BOOKMARK_LABEL_MIN_GAP) {
      drawUserBookmarkLabel(ctx, bookmark, y)
      lastLabelY = y
    }
  }
  addActivePlaybackCounter('render', 'userBookmarksScanned', scanned)
  addActivePlaybackCounter('render', 'userBookmarksVisible', visibleCount)
}
function drawUserBookmarkTick(ctx: CanvasRenderingContext2D, bookmark: UserBookmark, y: number) {
  ctx.save()
  // Draw horizontal line across entire width
  ctx.strokeStyle = withAlpha(USER_BOOKMARK_COLOR, 0.5)
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(BOOKMARK_GAP_WIDTH, y)
  ctx.lineTo(logicalWidth, y)
  ctx.stroke()

  // Draw left tick with glow
  ctx.strokeStyle = USER_BOOKMARK_COLOR
  ctx.shadowColor = withAlpha(USER_BOOKMARK_COLOR, 0.72)
  ctx.shadowBlur = 7
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(BOOKMARK_GAP_WIDTH, y)
  ctx.stroke()

  ctx.fillStyle = USER_BOOKMARK_COLOR
  roundedRect(ctx, 0, y - 4, BOOKMARK_GAP_WIDTH - 4, 8, 2)
  ctx.fill()
  ctx.restore()
}
function drawUserBookmarkLabel(ctx: CanvasRenderingContext2D, bookmark: UserBookmark, y: number) {
  const text = bookmark.label.length > 18 ? `${bookmark.label.slice(0, 17)}…` : bookmark.label
  ctx.save()
  ctx.font = '700 16px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = USER_BOOKMARK_COLOR
  ctx.strokeText(text, BOOKMARK_GAP_WIDTH + 4, y + 4)
  ctx.fillText(text, BOOKMARK_GAP_WIDTH + 4, y + 4)
  ctx.restore()
}
function drawBookmarkGap(ctx: CanvasRenderingContext2D) {
  ctx.save()
  const gradient = ctx.createLinearGradient(0, 0, BOOKMARK_GAP_WIDTH, 0)
  gradient.addColorStop(0, 'rgba(255, 187, 50, 0.12)')
  gradient.addColorStop(0.7, 'rgba(255, 187, 50, 0.06)')
  gradient.addColorStop(1, 'rgba(255, 187, 50, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, BOOKMARK_GAP_WIDTH, logicalHeight - HIT_LINE_HEIGHT)

  ctx.strokeStyle = 'rgba(255, 187, 50, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(BOOKMARK_GAP_WIDTH, 0)
  ctx.lineTo(BOOKMARK_GAP_WIDTH, logicalHeight - HIT_LINE_HEIGHT)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 187, 50, 0.5)'
  ctx.font = '600 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.save()
  ctx.translate(BOOKMARK_GAP_WIDTH / 2, logicalHeight / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('+ BOOKMARK', 0, 0)
  ctx.restore()
  ctx.restore()
}
function drawCurrentKey(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  const label = currentKeyLabel(session)
  if (!label) return
  const text = label
  const x = 8
  const y = logicalHeight - HIT_LINE_HEIGHT - 30

  ctx.save()
  ctx.font = '700 22px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = 'rgba(205,208,214,0.92)'
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}
function drawImpactParticles(ctx: CanvasRenderingContext2D) {
  impactParticles.draw(ctx)
}
function drawGrid(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  for (const line of verticalGridLines) {
    const x = line.x * logicalWidth / WHITE_KEY_COUNT
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, logicalHeight)
    ctx.strokeStyle = line.octave ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.18)'
    ctx.lineWidth = line.octave ? 1.4 : 1
    ctx.stroke()
  }

  const windowUs = sessionWindowUs(session)
  let scanned = 0
  let visibleCount = 0
  for (let index = 0; index < session.measureGridUs.length; index += 1) {
    scanned += 1
    const us = session.measureGridUs[index]
    if (us < session.currentUs || us > session.currentUs + windowUs) continue
    visibleCount += 1
    const y = logicalHeight - ((us - session.currentUs) / windowUs) * logicalHeight
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(logicalWidth, y)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1
    ctx.stroke()

    if (y > 14) {
      ctx.save()
      ctx.font = '600 11px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeStyle = 'rgba(0,0,0,0.62)'
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.strokeText(String(index + 1), 4, y - 4)
      ctx.fillText(String(index + 1), 4, y - 4)
      ctx.restore()
    }
  }
  addActivePlaybackCounter('render', 'measureLinesScanned', scanned)
  addActivePlaybackCounter('render', 'measureLinesVisible', visibleCount)
}
function drawLoopRegion(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  const loopState = session.loopState
  if (!player.loopRegionConfigured) return

  const windowUs = sessionWindowUs(session)
  const viewStartUs = session.currentUs
  const viewEndUs = session.currentUs + windowUs

  if (loopState.endUs < viewStartUs || loopState.startUs > viewEndUs) return

  const loopStartY = logicalHeight - ((loopState.startUs - session.currentUs) / windowUs) * logicalHeight
  const loopEndY = logicalHeight - ((loopState.endUs - session.currentUs) / windowUs) * logicalHeight

  ctx.save()
  ctx.fillStyle = 'rgba(251, 191, 36, 0.08)'
  const topY = Math.max(0, Math.min(loopStartY, loopEndY))
  const bottomY = Math.min(logicalHeight, Math.max(loopStartY, loopEndY))
  ctx.fillRect(0, topY, logicalWidth, bottomY - topY)

  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 4])

  if (loopState.endUs >= viewStartUs && loopState.endUs <= viewEndUs) {
    ctx.beginPath()
    ctx.moveTo(0, loopEndY)
    ctx.lineTo(logicalWidth, loopEndY)
    ctx.stroke()
  }

  if (loopState.startUs >= viewStartUs && loopState.startUs <= viewEndUs) {
    ctx.beginPath()
    ctx.moveTo(0, loopStartY)
    ctx.lineTo(logicalWidth, loopStartY)
    ctx.stroke()
  }

  ctx.setLineDash([])
  ctx.restore()
}

function drawNoteBody(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fillColor: string) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.36)'
  ctx.shadowBlur = 3.2
  ctx.shadowOffsetX = 2.5
  ctx.shadowOffsetY = 3
  roundedRect(ctx, x, y, w, h, 5)
  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.restore()

  const innerX = x + 1
  const innerY = y + 1
  const innerW = Math.max(0, w - 2)
  const innerH = Math.max(0, h - 2)
  const bevel = ctx.createLinearGradient(x, y, x + w, y + h)
  bevel.addColorStop(0, 'rgba(255,255,255,0.48)')
  bevel.addColorStop(0.22, 'rgba(255,255,255,0.14)')
  bevel.addColorStop(0.58, 'rgba(0,0,0,0)')
  bevel.addColorStop(1, 'rgba(0,0,0,0.28)')
  roundedRect(ctx, innerX, innerY, innerW, innerH, 4)
  ctx.fillStyle = bevel
  ctx.fill()

  roundedRect(ctx, innerX, innerY, innerW, 1.5, 1)
  ctx.fillStyle = 'rgba(255,255,255,0.52)'
  ctx.fill()
}

function drawNote(ctx: CanvasRenderingContext2D, note: LaidOutNote<SessionNote>) {
  const x = note.x
  const y = note.y - note.height
  const w = Math.max(1, Math.round(note.width))
  const h = Math.max(1, Math.round(note.height))
  const fillColor = color(note)

  drawNoteBody(ctx, x, y, w, h, fillColor)
  if (settings.showFingerHints && note.finger && settings.noteLabelMode !== 'finger-hint') drawFingerBadge(ctx, note, true)
}

function fingerBadgeColor(finger?: number | null) {
  if (!settings.showColoredFingerHints) return '#ffffff'
  switch (finger) {
    case 1: return '#22C55E'
    case 2: return '#FACC15'
    case 3: return '#A855F7'
    case 4: return '#3B82F6'
    case 5: return '#EF4444'
    default: return '#ffffff'
  }
}

function drawFingerBadge(ctx: CanvasRenderingContext2D, note: LaidOutNote<SessionNote>, belowNote = false) {
  const radius = Math.max(9, Math.min(15, note.width * 0.32))
  const x = note.x + note.width / 2
  const y = belowNote
    ? note.initialY + radius + 6
    : Math.max(note.y - note.height + radius + 4, note.initialY - radius - 5)
  const size = radius * 2
  ctx.save()
  ctx.fillStyle = fingerBadgeColor(note.finger)
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  if (note.fingerSource === 'manual') {
    roundedRect(ctx, x - radius, y - radius, size, size, 3)
  } else {
    ctx.arc(x, y, radius, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#111827'
  ctx.font = `800 ${Math.round(radius * 1.2)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(note.finger), x, y + 0.5)
  ctx.restore()
}

function drawNoteLabel(ctx: CanvasRenderingContext2D, note: LaidOutNote<SessionNote>, text: string) {
  const baseFontSize = 16
  const fontSize = baseFontSize + settings.noteLabelSize * 2
  ctx.save()
  ctx.font = `600 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.82)'
  ctx.fillStyle = '#ffffff'
  const x = note.x + note.width / 2
  const y = note.initialY - 6
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}

function publishSpriteCacheStats(profile: PlaybackProfilerContext | null) {
  void profile
}

function draw(dt: number, nowMs: number, frameProfile: PlaybackProfilerContext | null) {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  if (!logicalWidth || !logicalHeight) resizeCanvas()
  measurePlaybackSpan(frameProfile, 'frame.clearBackground', () => {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, logicalWidth, logicalHeight)
    if (!props.transparentBackground) {
      ctx.fillStyle = PIANO_ROLL_BACKGROUND
      ctx.fillRect(0, 0, logicalWidth, logicalHeight)
    }
  })

  const session = player.session
  if (!session) {
    lastSessionRef = null
    lastCurrentUs = Number.NEGATIVE_INFINITY
    measurePlaybackSpan(frameProfile, 'frame.updateEffects', () => updateEffects(dt))
    measurePlaybackSpan(frameProfile, 'frame.drawHitLine', () => drawHitLine(ctx, true))
    measurePlaybackSpan(frameProfile, 'frame.drawParticles', () => drawImpactParticles(ctx))
    setPlaybackGauge(frameProfile, 'particlesLive', impactParticles.liveCount())
    publishSpriteCacheStats(frameProfile)
    return
  }

  measurePlaybackSpan(frameProfile, 'frame.syncEffectSession', () => syncEffectSession(session))
  measurePlaybackSpan(frameProfile, 'frame.syncTrackRenderMeta', () => syncTrackRenderMeta(session))
  if (props.bookmarkMode) measurePlaybackSpan(frameProfile, 'frame.drawBookmarkGap', () => drawBookmarkGap(ctx))
  if (settings.showGrid) measurePlaybackSpan(frameProfile, 'frame.drawGrid', () => drawGrid(ctx, session))
  measurePlaybackSpan(frameProfile, 'frame.drawLoopRegion', () => drawLoopRegion(ctx, session))
  measurePlaybackSpan(frameProfile, 'frame.drawBookmarks', () => drawBookmarks(ctx, session))
  measurePlaybackSpan(frameProfile, 'frame.drawUserBookmarks', () => drawUserBookmarks(ctx, session))
  measurePlaybackSpan(frameProfile, 'frame.drawCurrentKey', () => drawCurrentKey(ctx, session))

  const notes = measurePlaybackSpan(frameProfile, 'frame.layoutNotes', () => layoutNotes(session.notes, session.currentUs, 3.25 / (session.zoomPercent / 100), logicalWidth, logicalHeight))
  setPlaybackGauge(frameProfile, 'laidOutNotes', notes.length)
  measurePlaybackSpan(frameProfile, 'frame.updateEffects', () => updateEffects(dt))

  const visibleNotes: LaidOutNote<SessionNote>[] = []
  if (settings.showFallingNotes) {
    measurePlaybackSpan(frameProfile, 'frame.triggerImpacts', () => triggerImpacts(notes, session, nowMs))
    measurePlaybackSpan(frameProfile, 'frame.drawNotes', () => {
      for (const note of notes) {
        if (!visible(note)) continue
        visibleNotes.push(note)
        drawNote(ctx, note)
      }
    })
    if (settings.showNoteLabels) {
      let labelsDrawn = 0
      measurePlaybackSpan(frameProfile, 'frame.drawLabels', () => {
        const keyAccidentals = currentKeySignatureAccidentals(session)
        for (const note of visibleNotes) {
          if (settings.noteLabelMode === 'finger-hint') {
            if (!note.finger) continue
            labelsDrawn += 1
            drawFingerBadge(ctx, note, false)
            continue
          }
          const text = getNoteLabel(settings.noteLabelMode, note.noteId, keyAccidentals)
          if (!text) continue
          labelsDrawn += 1
          drawNoteLabel(ctx, note, text)
        }
      })
      setPlaybackGauge(frameProfile, 'labelsDrawn', labelsDrawn)
    }
  }

  setPlaybackGauge(frameProfile, 'visibleNotes', visibleNotes.length)
  setPlaybackGauge(frameProfile, 'hiddenNotes', Math.max(0, notes.length - visibleNotes.length))
  setPlaybackGauge(frameProfile, 'particlesLive', impactParticles.liveCount())
  setPlaybackGauge(frameProfile, 'floatingParticlesLive', impactParticles.floatingCount())
  const isStopped = session.paused || session.finished
  measurePlaybackSpan(frameProfile, 'frame.drawHitLine', () => drawHitLine(ctx, isStopped))
  if (settings.showFallingNotes) {
    measurePlaybackSpan(frameProfile, 'frame.drawParticles', () => drawImpactParticles(ctx))
  }
  publishSpriteCacheStats(frameProfile)
}

function drawFrame() {
  const now = performance.now()
  const rawDt = now - lastFrameMs
  if (settings.advancedReduceAnimations && rawDt < 33.0) {
    rafId = requestAnimationFrame(drawFrame)
    return
  }
  const dt = Math.min(32, rawDt)
  lastFrameMs = now
  fpsFrames += 1
  const elapsedMs = now - fpsLastSampleMs
  const session = player.session
  const progressRatio = session?.loopState.durationUs ? session.currentUs / session.loopState.durationUs : 0
  const frameProfile = beginRenderFrame({ currentUs: session?.currentUs ?? 0, progressRatio, notesTotal: session?.notes.length ?? 0, rafDeltaMs: rawDt })
  try {
    if (elapsedMs >= 500) {
      lastFps = fpsFrames * 1000 / elapsedMs
      fpsFrames = 0
      fpsLastSampleMs = now
    }
    setPlaybackGauge(frameProfile, 'fps', lastFps)
    addPlaybackCounter(frameProfile, rawDt > 16.7 ? 'slowFrames16' : 'framesWithin16', 1)
    if (rawDt > 33.3) addPlaybackCounter(frameProfile, 'slowFrames33')
    if (rawDt > 50) addPlaybackCounter(frameProfile, 'slowFrames50')
    draw(dt, now, frameProfile)
  } finally {
    endRenderFrame(frameProfile)
  }
  rafId = requestAnimationFrame(drawFrame)
}

function handleTouchStart(event: TouchEvent) {
  if (!player.canSeek || !player.session) return
  if (event.touches.length !== 1) return

  const touch = event.touches[0]
  touchStartY = touch.clientY
  touchStartUs = player.session.currentUs
  isTouchDragging = true
  player.blockPlaybackOutput()
}

function handleTouchMove(event: TouchEvent) {
  if (!isTouchDragging || !player.canSeek || !player.session) return
  if (event.touches.length !== 1) {
    if (isTouchDragging) player.unblockPlaybackOutput()
    isTouchDragging = false
    return
  }

  event.preventDefault()

  const touch = event.touches[0]
  const deltaY = touch.clientY - touchStartY

  // Kéo lên (deltaY < 0) -> tua thuận (tăng currentUs)
  // Kéo xuống (deltaY > 0) -> tua ngược (giảm currentUs)
  const windowUs = sessionWindowUs(player.session)
  const usPerPixel = windowUs / logicalHeight * SCROLL_SENSITIVITY
  const deltaUs = deltaY * usPerPixel

  const targetUs = touchStartUs + deltaUs
  player.seekToUs(targetUs)
}

function handleTouchEnd() {
  if (isTouchDragging) player.unblockPlaybackOutput()
  isTouchDragging = false
}

function getCanvasCoordinates(event: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

function yToTimeUs(y: number, session: NonNullable<typeof player.session>) {
  const windowUs = sessionWindowUs(session)
  return session.currentUs + (1 - y / logicalHeight) * windowUs
}

function getHoveredLoopEdge(y: number, session: NonNullable<typeof player.session>): LoopDragEdge {
  const loopState = session.loopState
  if (!props.loopSetupActive || !player.loopRegionConfigured) return null

  const windowUs = sessionWindowUs(session)
  const loopStartY = logicalHeight - ((loopState.startUs - session.currentUs) / windowUs) * logicalHeight
  const loopEndY = logicalHeight - ((loopState.endUs - session.currentUs) / windowUs) * logicalHeight

  if (Math.abs(y - loopStartY) <= LOOP_EDGE_HIT_ZONE) return 'start'
  if (Math.abs(y - loopEndY) <= LOOP_EDGE_HIT_ZONE) return 'end'
  return null
}

function handleCanvasMouseMove(event: MouseEvent) {
  const canvas = canvasRef.value
  const session = player.session
  if (!canvas || !session) return

  const coords = getCanvasCoordinates(event)
  if (!coords) return

  const edge = getHoveredLoopEdge(coords.y, session)
  if (edge) {
    canvas.style.cursor = 'ns-resize'
  } else if (props.fingerMode) {
    canvas.style.cursor = 'pointer'
  } else if (player.canSeek) {
    canvas.style.cursor = isTouchDragging ? 'grabbing' : 'grab'
  } else {
    canvas.style.cursor = 'default'
  }
}

function handleLoopEdgeDrag(event: MouseEvent) {
  if (!draggingLoopEdge || !player.session) return

  const coords = getCanvasCoordinates(event)
  if (!coords) return

  const timeUs = yToTimeUs(coords.y, player.session)
  const snapped = player.snapToMeasure(timeUs)
  const loop = player.session.loopState

  if (draggingLoopEdge === 'start') {
    if (snapped < loop.endUs && snapped >= 0) {
      player.setLoopRegion(snapped, loop.endUs)
    }
  } else {
    const durationUs = loop.durationUs
    if (snapped > loop.startUs && snapped <= durationUs) {
      player.setLoopRegion(loop.startUs, snapped)
    }
  }
}

function handleLoopEdgeDragEnd() {
  if (draggingLoopEdge) player.unblockPlaybackOutput()
  draggingLoopEdge = null
  window.removeEventListener('mousemove', handleLoopEdgeDrag)
  window.removeEventListener('mouseup', handleLoopEdgeDragEnd)
}

function handleWheel(event: WheelEvent) {
  const session = player.session
  if (!session || !player.canSeek) return

  event.preventDefault()

  const windowUs = sessionWindowUs(session)
  const scrollUs = (-event.deltaY / 100) * (windowUs * 0.1)

  player.seekToUs(session.currentUs + scrollUs)
}

function handleBookmarkGapClick(event: MouseEvent) {
  if (!props.bookmarkMode) return false

  const session = player.session
  if (!session) return false

  const coords = getCanvasCoordinates(event)
  if (!coords) return false

  if (coords.x > BOOKMARK_GAP_WIDTH) return false

  const timeUs = yToTimeUs(coords.y, session)
  if (timeUs < 0) return false

  player.addUserBookmark(timeUs)
  return true
}

function handleFingerNoteClick(event: MouseEvent) {
  if (!props.fingerMode) return false
  const session = player.session
  if (!session) return false
  const coords = getCanvasCoordinates(event)
  if (!coords) return false
  const notes = layoutNotes(session.notes, session.currentUs, 3.25 / (session.zoomPercent / 100), logicalWidth, logicalHeight)
    .filter(note => visible(note))
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index]
    const top = note.y - note.height
    if (coords.x < note.x || coords.x > note.x + note.width || coords.y < top || coords.y > note.y) continue
    const canvas = canvasRef.value
    const rect = canvas?.getBoundingClientRect()
    emit('selectFingerNote', note, {
      x: rect ? rect.left + note.x : event.clientX,
      y: rect ? rect.top + top : event.clientY,
      width: note.width,
      height: note.height,
    })
    return true
  }
  return false
}

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return

  if (handleBookmarkGapClick(event) || handleFingerNoteClick(event)) {
    event.preventDefault()
    return
  }

  const session = player.session
  if (!session) return

  const coords = getCanvasCoordinates(event)
  if (!coords) return

  const edge = getHoveredLoopEdge(coords.y, session)
  if (edge) {
    draggingLoopEdge = edge
    player.blockPlaybackOutput()
    window.addEventListener('mousemove', handleLoopEdgeDrag)
    window.addEventListener('mouseup', handleLoopEdgeDragEnd)
    return
  }

  if (!player.canSeek) return

  touchStartY = event.clientY
  touchStartUs = session.currentUs
  isTouchDragging = true
  player.blockPlaybackOutput()

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event: MouseEvent) {
  if (!isTouchDragging || !player.canSeek || !player.session) return

  event.preventDefault()

  const deltaY = event.clientY - touchStartY

  const windowUs = sessionWindowUs(player.session)
  const usPerPixel = windowUs / logicalHeight * SCROLL_SENSITIVITY
  const deltaUs = deltaY * usPerPixel

  const targetUs = touchStartUs + deltaUs
  player.seekToUs(targetUs)
}

function handleMouseUp() {
  if (isTouchDragging) player.unblockPlaybackOutput()
  isTouchDragging = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

onMounted(() => {
  resizeCanvas()
  const canvas = canvasRef.value
  if (canvas) {
    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvas)

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)
    canvas.addEventListener('touchcancel', handleTouchEnd)
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleCanvasMouseMove)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
  }
  rafId = requestAnimationFrame(drawFrame)
})

onBeforeUnmount(() => {
  if (isTouchDragging || draggingLoopEdge) player.unblockPlaybackOutput(true)
  if (rafId !== null) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  clearEffects()

  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('touchstart', handleTouchStart)
    canvas.removeEventListener('touchmove', handleTouchMove)
    canvas.removeEventListener('touchend', handleTouchEnd)
    canvas.removeEventListener('touchcancel', handleTouchEnd)
    canvas.removeEventListener('mousedown', handleMouseDown)
    canvas.removeEventListener('mousemove', handleCanvasMouseMove)
    canvas.removeEventListener('wheel', handleWheel)
  }
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleLoopEdgeDrag)
  window.removeEventListener('mouseup', handleLoopEdgeDragEnd)
})
</script>

<template>
  <canvas ref="canvasRef" class="roll" :class="{ 'roll--seekable': player.canSeek, 'roll--transparent': props.transparentBackground }"></canvas>
</template>

<style scoped>
.roll { width: 100%; height: 100%; display: block; background: #303030; touch-action: none; }
.roll--transparent { background: transparent; }
.roll--seekable { cursor: grab; }
.roll--seekable:active { cursor: grabbing; }
</style>
