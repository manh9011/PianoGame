<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { layoutNotes } from '../../modules/render/pianoRollLayout'
import type { LaidOutNote } from '../../modules/render/pianoRollLayout'
import { createPianoKeys, WHITE_KEY_COUNT } from '../../modules/render/pianoGeometry'
import { getNoteLabel, notePitchClass } from '../../modules/render/pianoLabels'
import { FLAT_GRAY, MISSED_NOTE_COLOR } from '../../modules/game/trackProperties'
import { HAND_COLORS, HAND_HIT_COLORS } from '../../modules/game/handAssignment'
import { CanvasSpriteCache, createSpriteCanvas } from '../../modules/render/canvasSpriteCache'
import type { SessionBookmark, SessionNote, UserBookmark } from '../../modules/game/playSession'
import type { MidiBookmarkSource } from '../../modules/midi/midiTypes'

const props = defineProps<{
  bookmarkMode?: boolean
  benchmarkMode?: boolean
}>()

const USER_BOOKMARK_COLOR = '#FFBB32'
const BOOKMARK_GAP_WIDTH = 24
const PIANO_ROLL_BACKGROUND = '#303030'

const player = usePlayerStore()
const settings = useSettingsStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null
let logicalWidth = 0
let logicalHeight = 0
let pixelRatio = 1
const noteBodySprites = new CanvasSpriteCache(220)
const noteLabelSprites = new CanvasSpriteCache(180)
const perfStats = {
  frames: 0,
  fps: 0,
  lastSampleMs: performance.now(),
  drawMs: 0,
  layoutMs: 0,
  laidOutNotes: 0,
  visibleNotes: 0,
}

// Touch scroll state
let touchStartY = 0
let touchStartUs = 0
let isTouchDragging = false
const SCROLL_SENSITIVITY = 2.5 // microseconds per pixel
const pianoKeys = createPianoKeys()
const HIT_LINE_HEIGHT = 6

// Loop edge dragging state
const LOOP_EDGE_HIT_ZONE = 12
type LoopDragEdge = 'start' | 'end' | null
let draggingLoopEdge: LoopDragEdge = null

const BOOKMARK_LABEL_MIN_GAP = 18
const DEFAULT_KEY_SIGNATURE_LABEL = 'C Major'
const IMPACT_REWIND_THRESHOLD_US = 80_000
const IMPACT_SPAWN_INTERVAL_MS = 65
const MAX_PARTICLES = 160
const MAX_FLOATING_PARTICLES = 36
const IMPACT_RAY_SPRITE_SIZE = 128
const IMPACT_RAY_GLOW_SPRITE_SIZE = 160
const IMPACT_FLOAT_SPRITE_SIZE = 48
const IMPACT_LIGHT_COLOR = '#ffd166'
const IMPACT_LIGHT_CORE_COLOR = '#fff4bf'
const IMPACT_LIGHT_EDGE_COLOR = '#ffb703'
const IMPACT_ORANGE_COLOR = '#ff8f1f'
const IMPACT_RAY_VARIANTS = [
  { color: '#fff8dc', outerRx: 16, outerRy: 44, coreRx: 5.2, coreRy: 36, glowRx: 24, glowRy: 54, alpha: 0.88 },
  { color: '#fff4bf', outerRx: 18, outerRy: 42, coreRx: 4.8, coreRy: 38, glowRx: 28, glowRy: 52, alpha: 0.92 },
  { color: '#fff0a6', outerRx: 15, outerRy: 48, coreRx: 4.2, coreRy: 41, glowRx: 22, glowRy: 58, alpha: 0.9 },
  { color: '#ffec8a', outerRx: 20, outerRy: 40, coreRx: 6.2, coreRy: 32, glowRx: 30, glowRy: 50, alpha: 0.82 },
  { color: '#ffe572', outerRx: 14, outerRy: 46, coreRx: 3.8, coreRy: 39, glowRx: 20, glowRy: 56, alpha: 0.86 },
  { color: '#ffdf5c', outerRx: 19, outerRy: 45, coreRx: 5.6, coreRy: 37, glowRx: 27, glowRy: 55, alpha: 0.84 },
  { color: '#ffd94a', outerRx: 17, outerRy: 43, coreRx: 4.5, coreRy: 35, glowRx: 25, glowRy: 53, alpha: 0.9 },
  { color: '#ffd166', outerRx: 21, outerRy: 39, coreRx: 6.8, coreRy: 31, glowRx: 32, glowRy: 48, alpha: 0.8 },
  { color: '#ffc857', outerRx: 13, outerRy: 50, coreRx: 3.5, coreRy: 43, glowRx: 21, glowRy: 60, alpha: 0.88 },
  { color: '#ffc247', outerRx: 18, outerRy: 47, coreRx: 5.1, coreRy: 40, glowRx: 29, glowRy: 57, alpha: 0.82 },
  { color: '#ffbd38', outerRx: 16, outerRy: 41, coreRx: 4.4, coreRy: 34, glowRx: 23, glowRy: 51, alpha: 0.86 },
  { color: '#ffb703', outerRx: 22, outerRy: 44, coreRx: 7, coreRy: 36, glowRx: 34, glowRy: 54, alpha: 0.78 },
  { color: '#ffb11a', outerRx: 15, outerRy: 45, coreRx: 4, coreRy: 38, glowRx: 24, glowRy: 55, alpha: 0.84 },
  { color: '#ffaa22', outerRx: 19, outerRy: 42, coreRx: 5.8, coreRy: 34, glowRx: 31, glowRy: 52, alpha: 0.8 },
  { color: '#ffa329', outerRx: 17, outerRy: 49, coreRx: 4.7, coreRy: 42, glowRx: 26, glowRy: 59, alpha: 0.82 },
  { color: '#ff9c2f', outerRx: 14, outerRy: 43, coreRx: 3.7, coreRy: 36, glowRx: 22, glowRy: 53, alpha: 0.86 },
  { color: '#ff9635', outerRx: 21, outerRy: 46, coreRx: 6.4, coreRy: 39, glowRx: 33, glowRy: 56, alpha: 0.78 },
  { color: '#ff8f1f', outerRx: 16, outerRy: 48, coreRx: 4.2, coreRy: 41, glowRx: 25, glowRy: 58, alpha: 0.82 },
  { color: '#ff881a', outerRx: 18, outerRy: 40, coreRx: 5, coreRy: 33, glowRx: 28, glowRy: 50, alpha: 0.8 },
  { color: '#ff8216', outerRx: 13, outerRy: 47, coreRx: 3.4, coreRy: 40, glowRx: 21, glowRy: 57, alpha: 0.84 },
  { color: '#ff7c12', outerRx: 20, outerRy: 44, coreRx: 6, coreRy: 37, glowRx: 30, glowRy: 54, alpha: 0.78 },
  { color: '#ffb84d', outerRx: 15, outerRy: 39, coreRx: 4.1, coreRy: 32, glowRx: 23, glowRy: 49, alpha: 0.88 },
  { color: '#ffc15f', outerRx: 22, outerRy: 49, coreRx: 7.2, coreRy: 42, glowRx: 35, glowRy: 59, alpha: 0.78 },
  { color: '#ffca70', outerRx: 17, outerRy: 46, coreRx: 4.8, coreRy: 39, glowRx: 26, glowRy: 56, alpha: 0.84 },
  { color: '#ffd37f', outerRx: 19, outerRy: 38, coreRx: 5.4, coreRy: 31, glowRx: 29, glowRy: 48, alpha: 0.86 },
  { color: '#ffe08f', outerRx: 14, outerRy: 42, coreRx: 3.6, coreRy: 35, glowRx: 22, glowRy: 52, alpha: 0.9 },
  { color: '#ffeaa3', outerRx: 20, outerRy: 50, coreRx: 6.5, coreRy: 43, glowRx: 31, glowRy: 60, alpha: 0.82 },
  { color: '#fff1b7', outerRx: 16, outerRy: 45, coreRx: 4.5, coreRy: 38, glowRx: 24, glowRy: 55, alpha: 0.92 },
  { color: '#ffad33', outerRx: 18, outerRy: 41, coreRx: 5.2, coreRy: 34, glowRx: 27, glowRy: 51, alpha: 0.8 },
  { color: '#ff991f', outerRx: 15, outerRy: 48, coreRx: 4, coreRy: 41, glowRx: 23, glowRy: 58, alpha: 0.82 },
] as const

type ImpactParticle = {
  x: number
  y: number
  angle: number
  startLength: number
  endLength: number
  thickness: number
  life: number
  maxLife: number
  colorIndex: number
  glowWidth: number
  glowAlpha: number
}

type FloatingImpactParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  life: number
  maxLife: number
  colorIndex: number
}

const particles: ImpactParticle[] = []
const floatingParticles: FloatingImpactParticle[] = []
const activeImpactSpawns = new Map<string, number>()
const raySprites = IMPACT_RAY_VARIANTS.map(createRaySprite)
const rayGlowSprites = IMPACT_RAY_VARIANTS.map(createRayGlowSprite)
const floatSprites = IMPACT_RAY_VARIANTS.map(createFloatSprite)
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
  if (!track || track.mode === 'notPlayed') return FLAT_GRAY
  if (note.state === 'missed') return MISSED_NOTE_COLOR
  if (note.state === 'hit') return track.hitColor || HAND_HIT_COLORS[note.hand]
  return track.color || HAND_COLORS[note.hand]
}
function visible(note: SessionNote) {
  const mode = trackRenderMeta.get(note.trackId)?.mode
  return mode !== 'playedButHidden' && mode !== 'notPlayed'
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
  particles.length = 0
  floatingParticles.length = 0
  activeImpactSpawns.clear()
}
function syncEffectSession(session: NonNullable<typeof player.session>) {
  if (session !== lastSessionRef) {
    clearEffects()
    noteBodySprites.clear()
    noteLabelSprites.clear()
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
function createRaySprite(variant: typeof IMPACT_RAY_VARIANTS[number]) {
  const canvas = document.createElement('canvas')
  canvas.width = IMPACT_RAY_SPRITE_SIZE
  canvas.height = IMPACT_RAY_SPRITE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const center = IMPACT_RAY_SPRITE_SIZE / 2
  ctx.globalCompositeOperation = 'lighter'

  const outer = ctx.createRadialGradient(center, center, 0, center, center, center * 0.85)
  outer.addColorStop(0, withAlpha(variant.color, 0.86 * variant.alpha))
  outer.addColorStop(0.36, withAlpha(IMPACT_LIGHT_COLOR, 0.5 * variant.alpha))
  outer.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = outer
  ctx.beginPath()
  ctx.ellipse(center, center, variant.outerRx, variant.outerRy, 0, 0, Math.PI * 2)
  ctx.fill()

  const core = ctx.createRadialGradient(center, center, 0, center, center, center * 0.55)
  core.addColorStop(0, `rgba(255,255,255,${0.96 * variant.alpha})`)
  core.addColorStop(0.38, withAlpha(IMPACT_LIGHT_CORE_COLOR, 0.88 * variant.alpha))
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.ellipse(center, center, variant.coreRx, variant.coreRy, 0, 0, Math.PI * 2)
  ctx.fill()

  return canvas
}
function createRayGlowSprite(variant: typeof IMPACT_RAY_VARIANTS[number]) {
  const canvas = document.createElement('canvas')
  canvas.width = IMPACT_RAY_GLOW_SPRITE_SIZE
  canvas.height = IMPACT_RAY_GLOW_SPRITE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const center = IMPACT_RAY_GLOW_SPRITE_SIZE / 2
  ctx.globalCompositeOperation = 'lighter'
  ctx.shadowColor = withAlpha(variant.color, 0.85 * variant.alpha)
  ctx.shadowBlur = 22
  ctx.fillStyle = withAlpha(IMPACT_LIGHT_EDGE_COLOR, 0.3 * variant.alpha)
  ctx.beginPath()
  ctx.ellipse(center, center, variant.glowRx, variant.glowRy, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = withAlpha(variant.color, 0.7 * variant.alpha)
  ctx.shadowBlur = 14
  ctx.fillStyle = withAlpha(IMPACT_LIGHT_COLOR, 0.18 * variant.alpha)
  ctx.beginPath()
  ctx.ellipse(center, center, variant.glowRx * 0.72, variant.glowRy * 0.8, 0, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}
function createFloatSprite(variant: typeof IMPACT_RAY_VARIANTS[number]) {
  const canvas = document.createElement('canvas')
  canvas.width = IMPACT_FLOAT_SPRITE_SIZE
  canvas.height = IMPACT_FLOAT_SPRITE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const center = IMPACT_FLOAT_SPRITE_SIZE / 2
  const glow = ctx.createRadialGradient(center, center, 0, center, center, center)
  glow.addColorStop(0, `rgba(255,255,255,${0.92 * variant.alpha})`)
  glow.addColorStop(0.32, withAlpha(variant.color, 0.72 * variant.alpha))
  glow.addColorStop(0.72, withAlpha(IMPACT_LIGHT_EDGE_COLOR, 0.22 * variant.alpha))
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, IMPACT_FLOAT_SPRITE_SIZE, IMPACT_FLOAT_SPRITE_SIZE)
  return canvas
}
function spawnImpact(note: LaidOutNote<SessionNote>) {
  const y = logicalHeight + 4
  const particleCount = Math.max(7, Math.min(16, Math.round(note.width / 4.5)))
  const left = note.x + Math.min(2, note.width * 0.08)
  const usableWidth = Math.max(1, note.width - Math.min(4, note.width * 0.16))
  const minHeight = Math.max(0, note.width * 0.75)
  const maxHeight = Math.max(minHeight + 1, note.width * 0.75 * 1.5)

  for (let i = 0; i < particleCount; i += 1) {
    const ratio = particleCount === 1 ? 0.5 : i / (particleCount - 1)
    const sideBias = ratio - 0.5
    const spread = sideBias * 0.72 + (Math.random() - 0.5) * 0.28
    const angle = -Math.PI / 2 + spread
    const accent = Math.random() < 0.14
    particles.push({
      x: left + usableWidth * ratio + (Math.random() - 0.5) * Math.min(3, note.width * 0.08),
      y: y - Math.random() * 0.6,
      angle,
      startLength: Math.random() * minHeight,
      endLength: (minHeight + Math.random() * (maxHeight - minHeight)) * (accent ? 1.35 + Math.random() * 0.35 : 1),
      thickness: (0.6 + Math.random() * 1.15) * (accent ? 1.05 : 1),
      life: 190 + Math.random() * 160,
      maxLife: 350,
      colorIndex: Math.floor(Math.random() * IMPACT_RAY_VARIANTS.length),
      glowWidth: 1.2 + Math.random() * 1.05,
      glowAlpha: 0.2 + Math.random() * 0.22,
    })
  }
  if (Math.random() < 0.35) {
    const floatCount = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < floatCount; i += 1) {
      floatingParticles.push({
        x: left + Math.random() * usableWidth,
        y: y - Math.random() * 8,
        vx: (Math.random() - 0.5) * 0.035,
        vy: -0.035 - Math.random() * 0.055,
        radius: 4 + Math.random() * 7,
        life: 520 + Math.random() * 420,
        maxLife: 940,
        colorIndex: Math.floor(Math.random() * IMPACT_RAY_VARIANTS.length),
      })
    }
  }

  while (particles.length > MAX_PARTICLES) particles.shift()
  while (floatingParticles.length > MAX_FLOATING_PARTICLES) floatingParticles.shift()
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

    const lastSpawnMs = activeImpactSpawns.get(key)
    if (lastSpawnMs !== undefined && nowMs - lastSpawnMs < IMPACT_SPAWN_INTERVAL_MS) continue

    activeImpactSpawns.set(key, nowMs)
    spawnImpact(note)
  }

  for (const key of activeImpactSpawns.keys()) {
    if (!touchingKeys.has(key)) activeImpactSpawns.delete(key)
  }
}
function updateEffects(dt: number) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i]
    particle.life -= dt
    if (particle.life <= 0) particles.splice(i, 1)
  }

  for (let i = floatingParticles.length - 1; i >= 0; i -= 1) {
    const particle = floatingParticles[i]
    particle.life -= dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 0.998
    particle.vy *= 0.998
    if (particle.life <= 0) floatingParticles.splice(i, 1)
  }
}
function drawHitLine(ctx: CanvasRenderingContext2D, isStopped: boolean) {
  const y = logicalHeight - HIT_LINE_HEIGHT
  const gradient = ctx.createLinearGradient(0, y, 0, y + HIT_LINE_HEIGHT)
  if (isStopped) {
    gradient.addColorStop(0, '#4a1010')
    gradient.addColorStop(0.5, '#8b2020')
    gradient.addColorStop(1, '#4a1010')
  } else {
    gradient.addColorStop(0, '#383838')
    gradient.addColorStop(0.5, '#707070')
    gradient.addColorStop(1, '#383838')
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, y, logicalWidth, HIT_LINE_HEIGHT)
}
function bookmarkVisible(source: MidiBookmarkSource | 'user') {
  if (source === 'user') return settings.showMyBookmarks
  if (source === 'metadata') return settings.showMetadataBookmarks
  if (source === 'keySignature') return settings.showKeySignatureBookmarks
  return settings.showMidiMarkers
}
function visibleBookmarks(session: NonNullable<typeof player.session>) {
  return session.bookmarks.filter(bookmark => bookmarkVisible(bookmark.source))
}
function currentKeySignature(session: NonNullable<typeof player.session>) {
  let current = null
  for (const signature of session.keySignatures) {
    if (signature.timeUs > session.currentUs) break
    current = signature
  }
  return current
}

function currentKeyLabel(session: NonNullable<typeof player.session>) {
  if (!settings.showKeySignatureBookmarks) return ''
  return currentKeySignature(session)?.label ?? DEFAULT_KEY_SIGNATURE_LABEL
}

function currentKeySignatureAccidentals(session: NonNullable<typeof player.session>) {
  return currentKeySignature(session)?.accidentals ?? 0
}
function drawBookmarks(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  const windowUs = session.showDuration * 1_000_000
  let lastLabelY = Number.NEGATIVE_INFINITY
  for (const bookmark of visibleBookmarks(session)) {
    if (bookmark.timeUs < session.currentUs || bookmark.timeUs > session.currentUs + windowUs) continue
    const y = logicalHeight - ((bookmark.timeUs - session.currentUs) / windowUs) * logicalHeight
    drawBookmarkTick(ctx, bookmark, y)
    if (y > 12 && y < logicalHeight - 10 && Math.abs(y - lastLabelY) >= BOOKMARK_LABEL_MIN_GAP) {
      drawBookmarkLabel(ctx, bookmark, y)
      lastLabelY = y
    }
  }
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
  const text = bookmark.label.length > 18 ? `${bookmark.label.slice(0, 17)}…` : bookmark.label
  ctx.save()
  ctx.font = '700 18px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = 'rgba(205,208,214,0.92)'
  ctx.strokeText(text, 8, y + 6)
  ctx.fillText(text, 8, y + 6)
  ctx.restore()
}
function drawUserBookmarks(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  if (!settings.showMyBookmarks) return
  const windowUs = session.showDuration * 1_000_000
  let lastLabelY = Number.NEGATIVE_INFINITY
  for (const bookmark of session.userBookmarks) {
    if (bookmark.timeUs < session.currentUs || bookmark.timeUs > session.currentUs + windowUs) continue
    const y = logicalHeight - ((bookmark.timeUs - session.currentUs) / windowUs) * logicalHeight
    drawUserBookmarkTick(ctx, bookmark, y)
    if (y > 12 && y < logicalHeight - 10 && Math.abs(y - lastLabelY) >= BOOKMARK_LABEL_MIN_GAP) {
      drawUserBookmarkLabel(ctx, bookmark, y)
      lastLabelY = y
    }
  }
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
  ctx.strokeStyle = 'rgba(0,0,0,0.72)'
  ctx.fillStyle = 'rgba(205,208,214,0.92)'
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}
function drawImpactParticles(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (const particle of floatingParticles) {
    const lifeRatio = Math.max(0, particle.life / particle.maxLife)
    const ageRatio = 1 - lifeRatio
    const alpha = Math.sin(Math.min(1, ageRatio) * Math.PI) * 0.72
    const size = particle.radius * (0.7 + ageRatio * 0.55)
    const sprite = floatSprites[particle.colorIndex]
    ctx.globalAlpha = alpha
    ctx.drawImage(sprite, particle.x - size, particle.y - size, size * 2, size * 2)
  }

  for (const particle of particles) {
    const lifeRatio = Math.max(0, particle.life / particle.maxLife)
    const ageRatio = 1 - lifeRatio
    const grow = Math.min(1, ageRatio / 0.32)
    const fade = lifeRatio < 0.42 ? lifeRatio / 0.42 : 1
    const alpha = Math.max(0, Math.min(1, fade))
    const sprite = raySprites[particle.colorIndex]
    const glowSprite = rayGlowSprites[particle.colorIndex]
    const height = particle.startLength + (particle.endLength - particle.startLength) * grow
    const coreWidth = particle.thickness * (10 + grow * 8)
    const glowWidth = coreWidth * particle.glowWidth * (1.05 + grow * 0.35)

    ctx.save()
    ctx.translate(particle.x, particle.y)
    ctx.rotate(particle.angle + Math.PI / 2)
    ctx.globalAlpha = alpha * particle.glowAlpha
    ctx.drawImage(glowSprite, -glowWidth / 2, -height, glowWidth, height)
    ctx.globalAlpha = alpha
    ctx.drawImage(sprite, -coreWidth / 2, -height, coreWidth, height)
    ctx.restore()
  }

  ctx.restore()
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

  const windowUs = session.showDuration * 1_000_000
  for (let index = 0; index < session.measureGridUs.length; index += 1) {
    const us = session.measureGridUs[index]
    if (us < session.currentUs || us > session.currentUs + windowUs) continue
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
      ctx.strokeStyle = 'rgba(0,0,0,0.62)'
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.strokeText(String(index + 1), 4, y - 4)
      ctx.fillText(String(index + 1), 4, y - 4)
      ctx.restore()
    }
  }
}
function drawLoopRegion(ctx: CanvasRenderingContext2D, session: NonNullable<typeof player.session>) {
  const loopState = session.loopState
  if (!loopState.enabled) return

  const windowUs = session.showDuration * 1_000_000
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

const NOTE_BODY_PAD_X = 8
const NOTE_BODY_PAD_Y = 10

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

function noteBodySpriteKey(width: number, height: number, fillColor: string) {
  return `note-body:v1:${Math.round(width)}:${Math.round(height)}:${fillColor}`
}

function drawNote(ctx: CanvasRenderingContext2D, note: LaidOutNote<SessionNote>) {
  const x = note.x
  const y = note.y - note.height
  const w = Math.max(1, Math.round(note.width))
  const h = Math.max(1, Math.round(note.height))
  const fillColor = color(note)
  const sprite = noteBodySprites.getOrCreate(noteBodySpriteKey(w, h, fillColor), () => {
    const canvas = createSpriteCanvas(w + NOTE_BODY_PAD_X * 2, h + NOTE_BODY_PAD_Y * 2)
    const spriteCtx = canvas.getContext('2d')
    if (!spriteCtx) return canvas
    drawNoteBody(spriteCtx, NOTE_BODY_PAD_X, NOTE_BODY_PAD_Y, w, h, fillColor)
    return canvas
  })

  ctx.drawImage(sprite, x - NOTE_BODY_PAD_X, y - NOTE_BODY_PAD_Y)
}

type NoteLabelSpriteOptions = {
  text: string
  fontSize: number
  fillStyle: string
  strokeStyle: string
  lineWidth: number
}

function getNoteLabelSprite(options: NoteLabelSpriteOptions) {
  const key = `note-label:v1:${options.text}:${options.fontSize}:${options.fillStyle}:${options.strokeStyle}:${options.lineWidth}`
  return noteLabelSprites.getOrCreate(key, () => {
    const measuringCanvas = createSpriteCanvas(1, 1)
    const measuring = measuringCanvas.getContext('2d')
    if (!measuring) return measuringCanvas
    const font = `600 ${options.fontSize}px sans-serif`
    measuring.font = font
    const metrics = measuring.measureText(options.text)
    const padding = Math.max(4, Math.ceil(options.lineWidth) + 2)
    const textWidth = Math.ceil(metrics.width)
    const textHeight = Math.ceil(
      (metrics.actualBoundingBoxAscent || options.fontSize * 0.8) +
      (metrics.actualBoundingBoxDescent || options.fontSize * 0.25)
    )
    const canvas = createSpriteCanvas(textWidth + padding * 2, textHeight + padding * 2)
    const spriteCtx = canvas.getContext('2d')
    if (!spriteCtx) return canvas
    spriteCtx.font = font
    spriteCtx.textAlign = 'center'
    spriteCtx.textBaseline = 'middle'
    spriteCtx.lineJoin = 'round'
    spriteCtx.lineWidth = options.lineWidth
    spriteCtx.strokeStyle = options.strokeStyle
    spriteCtx.fillStyle = options.fillStyle
    spriteCtx.strokeText(options.text, canvas.width / 2, canvas.height / 2)
    spriteCtx.fillText(options.text, canvas.width / 2, canvas.height / 2)
    return canvas
  })
}

function drawPerfOverlay(ctx: CanvasRenderingContext2D) {
  if (!props.benchmarkMode) return
  const lines = [
    `FPS ${perfStats.fps.toFixed(1)}`,
    `draw ${perfStats.drawMs.toFixed(1)}ms`,
    `layout ${perfStats.layoutMs.toFixed(1)}ms`,
    `notes ${perfStats.visibleNotes}/${perfStats.laidOutNotes}`,
    `particles ${particles.length + floatingParticles.length}`,
  ]
  ctx.save()
  ctx.font = '600 12px monospace'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#d9f99d'
  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], 16, 16 + index * 15)
  }
  ctx.restore()
}

function drawNoteLabel(ctx: CanvasRenderingContext2D, note: LaidOutNote<SessionNote>, text: string) {
  const baseFontSize = 16
  const fontSize = baseFontSize + settings.noteLabelSize * 2
  const sprite = getNoteLabelSprite({
    text,
    fontSize,
    fillStyle: '#ffffff',
    strokeStyle: 'rgba(0,0,0,0.82)',
    lineWidth: 3,
  })
  ctx.drawImage(sprite, note.x + note.width / 2 - sprite.width / 2, note.y - 6 - sprite.height / 2)
}
function draw(dt: number, nowMs: number) {
  const drawStartMs = props.benchmarkMode ? performance.now() : 0
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  if (!logicalWidth || !logicalHeight) resizeCanvas()
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, logicalWidth, logicalHeight)
  ctx.fillStyle = PIANO_ROLL_BACKGROUND
  ctx.fillRect(0, 0, logicalWidth, logicalHeight)

  const session = player.session
  if (!session) {
    lastSessionRef = null
    lastCurrentUs = Number.NEGATIVE_INFINITY
    updateEffects(dt)
    drawHitLine(ctx, true)
    drawImpactParticles(ctx)
    return
  }

  syncEffectSession(session)
  syncTrackRenderMeta(session)
  if (props.bookmarkMode) drawBookmarkGap(ctx)
  if (settings.showGrid) drawGrid(ctx, session)
  drawLoopRegion(ctx, session)
  drawBookmarks(ctx, session)
  drawUserBookmarks(ctx, session)
  drawCurrentKey(ctx, session)

  const layoutStartMs = props.benchmarkMode ? performance.now() : 0
  const notes = layoutNotes(session.notes, session.currentUs, session.showDuration, logicalWidth, logicalHeight)
  if (props.benchmarkMode) {
    perfStats.layoutMs = performance.now() - layoutStartMs
    perfStats.laidOutNotes = notes.length
    perfStats.visibleNotes = 0
  }
  updateEffects(dt)

  if (settings.showFallingNotes) {
    triggerImpacts(notes, session, nowMs)

    const keyAccidentals = settings.showNoteLabels ? currentKeySignatureAccidentals(session) : 0
    for (const note of notes) {
      if (!visible(note)) continue
      if (props.benchmarkMode) perfStats.visibleNotes += 1
      drawNote(ctx, note)
      if (settings.showNoteLabels) {
        const text = getNoteLabel(settings.noteLabelMode, note.noteId, keyAccidentals)
        if (text) drawNoteLabel(ctx, note, text)
      }
    }
  }

  const isStopped = session.paused || session.finished
  drawHitLine(ctx, isStopped)
  if (settings.showFallingNotes) {
    drawImpactParticles(ctx)
  }
  if (props.benchmarkMode) {
    perfStats.drawMs = performance.now() - drawStartMs
    drawPerfOverlay(ctx)
  }
}
function resetPerfStats() {
  perfStats.frames = 0
  perfStats.fps = 0
  perfStats.lastSampleMs = performance.now()
  perfStats.drawMs = 0
  perfStats.layoutMs = 0
  perfStats.laidOutNotes = 0
  perfStats.visibleNotes = 0
}

function drawFrame() {
  const now = performance.now()
  const dt = Math.min(32, now - lastFrameMs)
  lastFrameMs = now
  if (props.benchmarkMode) {
    perfStats.frames += 1
    const elapsedMs = now - perfStats.lastSampleMs
    if (elapsedMs >= 500) {
      perfStats.fps = perfStats.frames * 1000 / elapsedMs
      perfStats.frames = 0
      perfStats.lastSampleMs = now
    }
  }
  draw(dt, now)
  rafId = requestAnimationFrame(drawFrame)
}

function handleTouchStart(event: TouchEvent) {
  if (!player.canSeek || !player.session) return
  if (event.touches.length !== 1) return

  const touch = event.touches[0]
  touchStartY = touch.clientY
  touchStartUs = player.session.currentUs
  isTouchDragging = true
}

function handleTouchMove(event: TouchEvent) {
  if (!isTouchDragging || !player.canSeek || !player.session) return
  if (event.touches.length !== 1) {
    isTouchDragging = false
    return
  }

  event.preventDefault()

  const touch = event.touches[0]
  const deltaY = touch.clientY - touchStartY

  // Kéo lên (deltaY < 0) -> tua thuận (tăng currentUs)
  // Kéo xuống (deltaY > 0) -> tua ngược (giảm currentUs)
  const windowUs = player.session.showDuration * 1_000_000
  const usPerPixel = windowUs / logicalHeight * SCROLL_SENSITIVITY
  const deltaUs = deltaY * usPerPixel

  const targetUs = touchStartUs + deltaUs
  player.seekToUs(targetUs)
}

function handleTouchEnd() {
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
  const windowUs = session.showDuration * 1_000_000
  return session.currentUs + (1 - y / logicalHeight) * windowUs
}

function getHoveredLoopEdge(y: number, session: NonNullable<typeof player.session>): LoopDragEdge {
  const loopState = session.loopState
  if (!loopState.enabled) return null

  const windowUs = session.showDuration * 1_000_000
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
  draggingLoopEdge = null
  window.removeEventListener('mousemove', handleLoopEdgeDrag)
  window.removeEventListener('mouseup', handleLoopEdgeDragEnd)
}

function handleWheel(event: WheelEvent) {
  const session = player.session
  if (!session?.loopState.enabled || !player.canSeek) return

  event.preventDefault()

  const windowUs = session.showDuration * 1_000_000
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

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return

  if (handleBookmarkGapClick(event)) {
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
    window.addEventListener('mousemove', handleLoopEdgeDrag)
    window.addEventListener('mouseup', handleLoopEdgeDragEnd)
    return
  }

  if (!player.canSeek) return

  touchStartY = event.clientY
  touchStartUs = session.currentUs
  isTouchDragging = true

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event: MouseEvent) {
  if (!isTouchDragging || !player.canSeek || !player.session) return

  event.preventDefault()

  const deltaY = event.clientY - touchStartY

  const windowUs = player.session.showDuration * 1_000_000
  const usPerPixel = windowUs / logicalHeight * SCROLL_SENSITIVITY
  const deltaUs = deltaY * usPerPixel

  const targetUs = touchStartUs + deltaUs
  player.seekToUs(targetUs)
}

function handleMouseUp() {
  isTouchDragging = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

watch(() => props.benchmarkMode, enabled => {
  if (enabled) resetPerfStats()
})

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
  if (rafId !== null) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  clearEffects()
  noteBodySprites.clear()
  noteLabelSprites.clear()

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
  <canvas ref="canvasRef" class="roll" :class="{ 'roll--seekable': player.canSeek }"></canvas>
</template>

<style scoped>
.roll { width: 100%; height: 100%; display: block; background: #303030; touch-action: none; }
.roll--seekable { cursor: grab; }
.roll--seekable:active { cursor: grabbing; }
</style>
