<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useFreePlayStore, getFreePlayTrackLoopDurationUs } from '../../stores/freePlayStore'
import { createPianoKeys, WHITE_KEY_COUNT, type PianoKey } from '../../modules/render/pianoGeometry'
import { getKeyboardLabel, getVirtualPianoNoteIdFromKey } from '../../modules/render/pianoLabels'
import { HAND_COLORS } from '../../modules/game/handAssignment'
import { TRACK_INVISIBLE_COLOR } from '../../modules/game/trackProperties'
import { getKeyboardRange, isNoteInRange, type KeyboardRange } from '../../modules/render/keyboardRange'
import { CanvasSpriteCache, createSpriteCanvas } from '../../modules/render/canvasSpriteCache'
import { drawKeyboardHitLine, keyboardWhiteKeyTopOffset } from '../../modules/render/hitLineRenderer'
import type { Hand, SessionNote } from '../../modules/game/playSession'

const blackKeyRaisedImage = new Image()
blackKeyRaisedImage.src = `${import.meta.env.BASE_URL}keys/black-key-raised.png`

const blackKeyPressedImage = new Image()
blackKeyPressedImage.src = `${import.meta.env.BASE_URL}keys/black-key-pressed.png`

const props = defineProps<{
  transparentBackground?: boolean
  previewActiveFromTimeline?: boolean
}>()

const keys = createPianoKeys()
const whiteKeys = keys.filter(k => !k.black)
const blackKeys = keys.filter(k => k.black)
const player = usePlayerStore()
const settings = useSettingsStore()
const freePlay = useFreePlayStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const pointerNotes = new Map<number, number>()
const pressedComputerKeys = new Set<string>()
const REPRESS_RELEASE_MS = 85
const REPRESS_FLASH_MS = 130
const pressFlashStartedAt = new Map<number, number>()
const renderedPressCounts = new Map<number, number>()
const renderedActiveNotes = new Map<number, boolean>()
let pressFlashSession: object | null = null

type NotesByPitchCache = { notes: SessionNote[]; fingeringVersion: number; byPitch: Map<number, SessionNote[]> }
const notesByPitchCache = new WeakMap<object, NotesByPitchCache>()

let resizeObserver: ResizeObserver | null = null
let rafId: number | null = null
let dirty = true
let animatingPressFlash = false
let lastFrameMs = 0
let logicalWidth = 0
let logicalHeight = 0
let pixelRatio = 1
let keyboardBaseCanvas: HTMLCanvasElement | null = null
let keyboardBaseKey = ''
let keyboardBlackLayerCanvas: HTMLCanvasElement | null = null
let keyboardBlackLayerKey = ''
const keyboardLabelSprites = new CanvasSpriteCache(160)

const keyboardRange = computed<KeyboardRange>(() => {
  const session = player.session
  return session?.keyboardRange ?? getKeyboardRange(settings.keyboardRangeMode, session?.notes ?? [])
})

function isKeyDisabled(noteId: number): boolean {
  return !isNoteInRange(noteId, keyboardRange.value)
}

interface KeyRect { key: PianoKey; x: number; y: number; width: number; height: number }

function blackKeyHeight() {
  const canvas = canvasRef.value
  const source = canvas?.parentElement ?? canvas
  const value = source ? parseFloat(getComputedStyle(source).getPropertyValue('--black-key-height')) : Number.NaN
  return Number.isFinite(value) && value > 0 ? value : logicalHeight * (95 / 150)
}

function keyRect(key: PianoKey): KeyRect {
  const unitWidth = logicalWidth / WHITE_KEY_COUNT
  return {
    key,
    x: key.x * unitWidth,
    y: key.black ? 2 : 0,
    width: key.width * unitWidth,
    height: key.black ? blackKeyHeight() : logicalHeight,
  }
}

function trackForId(trackId: number | undefined) {
  const session = player.session
  return session?.tracks.find(track => track.trackId === trackId) ?? null
}

function isVisibleTrackId(trackId: number | undefined) {
  const track = trackForId(trackId)
  return !track || track.color !== TRACK_INVISIBLE_COLOR
}

let cachedFreePlayFrameTime = -1
const cachedFreePlayNotes = new Map<number, SessionNote[]>()

function prepareFreePlayNotes(nowMs: number) {
  if (player.session?.mode !== 'listen') return
  if (nowMs === cachedFreePlayFrameTime) return
  cachedFreePlayFrameTime = nowMs
  cachedFreePlayNotes.clear()
  
  const nowUs = freePlay.status === 'recording' && freePlay.recordStartMs
    ? Math.max(0, Math.round((performance.now() - freePlay.recordStartMs) * 1000))
    : (freePlay.viewUs ?? freePlay.recordingDurationUs)
    
  for (const track of freePlay.tracks) {
    if (!track.notes.length) continue
    const loopDurationUs = getFreePlayTrackLoopDurationUs(track, freePlay.bpm, freePlay.timeSignature)
    if (loopDurationUs <= 0) continue
    const localUs = track.loop ? nowUs % loopDurationUs : nowUs
    if (!track.loop && nowUs > loopDurationUs) continue
    
    for (const note of track.notes) {
      if (note.startUs > localUs || note.endUs <= localUs) continue
      const list = cachedFreePlayNotes.get(note.noteId) ?? []
      if (!list.length) cachedFreePlayNotes.set(note.noteId, list)
      list.push({ trackId: track.id, hand: 'unknown', color: track.color } as unknown as SessionNote)
    }
  }
}

function freePlayTimelineNotesAt(noteId: number): SessionNote[] {
  return cachedFreePlayNotes.get(noteId) ?? []
}

function visibleTimelineNotesAt(noteId: number) {
  const session = player.session
  if (!session) return []
  const list: SessionNote[] = []
  
  if (props.previewActiveFromTimeline) {
    list.push(...session.notes.filter(note => {
      if (note.noteId !== noteId) return false
      if (note.start > session.currentUs || note.end < session.currentUs) return false
      return isVisibleTrackId(note.trackId)
    }))
  }
  
  if (session.mode === 'listen') {
    list.push(...freePlayTimelineNotesAt(noteId))
  }
  return list
}

function timelineNoteFor(noteId: number) {
  return visibleTimelineNotesAt(noteId)[0] ?? null
}

function active(noteId: number) {
  const session = player.session
  return Boolean(
    (session?.activeNotes.has(noteId) && isVisibleTrackId(session.activeNoteTrackIds.get(noteId))) ||
    (session?.autoActiveNotes.has(noteId) && isVisibleTrackId(session.autoActiveNoteTrackIds.get(noteId))) ||
    visibleTimelineNotesAt(noteId).length
  )
}

function notePressCount(noteId: number) {
  const session = player.session
  if (!session) return 0
  const inputPressCount = isVisibleTrackId(session.activeNoteTrackIds.get(noteId))
    ? session.activeNotePressCounts.get(noteId) ?? 0
    : 0
  const autoPressCount = isVisibleTrackId(session.autoActiveNoteTrackIds.get(noteId))
    ? session.autoActiveNotePressCounts.get(noteId) ?? 0
    : 0
  return inputPressCount + autoPressCount + visibleTimelineNotesAt(noteId).length
}

function updatePressFlashes(nowMs: number) {
  prepareFreePlayNotes(nowMs)
  
  const session = player.session
  if (pressFlashSession !== session) {
    pressFlashSession = session
    pressFlashStartedAt.clear()
    renderedPressCounts.clear()
    renderedActiveNotes.clear()
  }
  if (!session) return
  if (settings.advancedReduceAnimations) {
    pressFlashStartedAt.clear()
    return
  }

  for (const key of keys) {
    const noteId = key.noteId
    const isActive = active(noteId)
    const count = notePressCount(noteId)
    if (renderedPressCounts.get(noteId) !== count) {
      const wasActive = renderedActiveNotes.get(noteId) ?? false
      renderedPressCounts.set(noteId, count)
      if (count > 0 && isActive) {
        pressFlashStartedAt.set(noteId, wasActive ? nowMs : nowMs - REPRESS_RELEASE_MS)
      }
    }

    const startedAt = pressFlashStartedAt.get(noteId)
    if (!isActive || (startedAt !== undefined && nowMs - startedAt >= REPRESS_RELEASE_MS + REPRESS_FLASH_MS)) {
      pressFlashStartedAt.delete(noteId)
    }
    renderedActiveNotes.set(noteId, isActive)
  }
}

function forcingRelease(noteId: number, nowMs: number) {
  const startedAt = pressFlashStartedAt.get(noteId)
  return startedAt !== undefined && nowMs - startedAt < REPRESS_RELEASE_MS
}

function pressFlashStrength(noteId: number, nowMs: number) {
  const startedAt = pressFlashStartedAt.get(noteId)
  if (startedAt === undefined) return 0
  const elapsedAfterRelease = nowMs - startedAt - REPRESS_RELEASE_MS
  if (elapsedAfterRelease < 0) return 0
  return Math.max(0, 1 - elapsedAfterRelease / REPRESS_FLASH_MS)
}

function activeColor(noteId: number) {
  const session = player.session
  if (!session) return HAND_COLORS.unknown
  const timelineNote = timelineNoteFor(noteId) as { trackId: number; hand: Hand; color?: string } | null
  if (timelineNote?.color) return timelineNote.color
  const trackId = session.autoActiveNoteTrackIds.get(noteId) ?? session.activeNoteTrackIds.get(noteId) ?? timelineNote?.trackId
  const track = session.tracks.find(t => t.trackId === trackId)
  if (track) return track.color
  const hand = session.autoActiveNoteHands.get(noteId) ?? session.activeNoteHands.get(noteId) ?? timelineNote?.hand ?? 'unknown'
  return HAND_COLORS[hand as Hand]
}

function notesByPitch() {
  const session = player.session
  if (!session) return null
  const cached = notesByPitchCache.get(session)
  if (cached?.notes === session.notes && cached.fingeringVersion === session.fingeringVersion) return cached.byPitch

  const byPitch = new Map<number, SessionNote[]>()
  for (const note of session.notes) {
    if (!note.finger) continue
    const list = byPitch.get(note.noteId) ?? []
    list.push(note)
    byPitch.set(note.noteId, list)
  }
  notesByPitchCache.set(session, { notes: session.notes, fingeringVersion: session.fingeringVersion, byPitch })
  return byPitch
}

function activeFingerLabel(noteId: number) {
  const session = player.session
  if (!session || !active(noteId)) return null
  const timelineNote = timelineNoteFor(noteId)
  const playableNoteId = noteId - session.octaveShift * 12
  const byPitch = notesByPitch()
  const candidates = playableNoteId === noteId
    ? byPitch?.get(noteId) ?? []
    : [...(byPitch?.get(noteId) ?? []), ...(byPitch?.get(playableNoteId) ?? [])]
  const activeTrackId = session.autoActiveNoteTrackIds.get(noteId) ?? session.activeNoteTrackIds.get(noteId) ?? timelineNote?.trackId
  const activeHand = session.autoActiveNoteHands.get(noteId) ?? session.activeNoteHands.get(noteId) ?? timelineNote?.hand
  let best: { finger: number; score: number } | null = null

  for (const note of candidates) {
    if (!note.finger) continue
    const overlapsCurrentTime = note.start <= session.currentUs && note.end >= session.currentUs
    const distance = overlapsCurrentTime
      ? 0
      : Math.min(Math.abs(note.start - session.currentUs), Math.abs(note.end - session.currentUs))
    const trackPenalty = activeTrackId !== undefined && note.trackId !== activeTrackId ? 10_000_000 : 0
    const handPenalty = activeHand && note.hand !== activeHand ? 5_000_000 : 0
    const score = distance + trackPenalty + handPenalty
    if (!best || score < best.score) best = { finger: note.finger, score }
  }

  return best ? String(best.finger) : null
}

function keyboardLabel(noteId: number) {
  if (settings.keyLabelMode === 'finger-hint') return activeFingerLabel(noteId)
  return getKeyboardLabel(settings.keyLabelMode, noteId, currentKeySignatureAccidentals())
}

function melodyWaitNote() {
  const session = player.session
  if (!session?.melodyWaitNoteId) return null
  return session.notes.find(note => note.id === session.melodyWaitNoteId) ?? null
}

function melodyWaitColor() {
  const session = player.session
  const note = melodyWaitNote()
  if (!session || !note) return HAND_COLORS.unknown
  const track = session.tracks.find(t => t.trackId === note.trackId)
  return track?.color ?? HAND_COLORS[note.hand]
}

function currentKeySignatureAccidentals() {
  const session = player.session
  if (!session) return 0
  let current = 0
  for (const signature of session.keySignatures) {
    if (signature.timeUs > session.currentUs) break
    current = signature.accidentals
  }
  return current
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const nextPixelRatio = window.devicePixelRatio || 1
  const nextWidth = Math.round(rect.width * nextPixelRatio)
  const nextHeight = Math.round(rect.height * nextPixelRatio)
  const sizeChanged = logicalWidth !== rect.width || logicalHeight !== rect.height || pixelRatio !== nextPixelRatio
  logicalWidth = rect.width
  logicalHeight = rect.height
  pixelRatio = nextPixelRatio
  if (canvas.width !== nextWidth) canvas.width = nextWidth
  if (canvas.height !== nextHeight) canvas.height = nextHeight
  if (sizeChanged) {
    invalidateKeyboardBaseLayer()
    requestDraw()
  }
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

function drawWhiteKey(ctx: CanvasRenderingContext2D, rect: KeyRect, isActive = active(rect.key.noteId), isDisabled = isKeyDisabled(rect.key.noteId), pressFlash = 0) {
  const { key, x, y, width, height } = rect
  const drawX = x + 0.25
  const drawY = y - keyboardWhiteKeyTopOffset()
  const drawWidth = Math.max(0, width - 0.5)
  const drawHeight = height - 0.5 - drawY
  const drawActive = isActive && !isDisabled
  const fill = ctx.createLinearGradient(drawX, drawY, drawX + drawWidth, drawY)
  if (drawActive) {
    const color = activeColor(key.noteId)
    fill.addColorStop(0, color)
    fill.addColorStop(1, color)
  } else if (isDisabled) {
    fill.addColorStop(0, '#42433f')
    fill.addColorStop(0.08, '#555650')
    fill.addColorStop(0.88, '#4b4c47')
    fill.addColorStop(1, '#343530')
  } else {
    fill.addColorStop(0, '#e3e4df')
    fill.addColorStop(0.08, '#f7f7f3')
    fill.addColorStop(0.88, '#f1f1ed')
    fill.addColorStop(1, '#d7d8d2')
  }

  roundedRect(ctx, drawX, drawY, drawWidth, drawHeight, 4)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = isDisabled ? '#111111' : '#000000'
  ctx.stroke()

  if (drawActive) {
    const glow = ctx.createLinearGradient(drawX, drawY, drawX, drawY + drawHeight)
    glow.addColorStop(0, 'rgba(255,255,255,0.28)')
    glow.addColorStop(0.4, 'rgba(255,255,255,0.06)')
    glow.addColorStop(1, 'rgba(0,0,0,0.18)')
    roundedRect(ctx, drawX + 1, drawY + 1, Math.max(0, drawWidth - 2), drawHeight - 2, 3)
    ctx.fillStyle = glow
    ctx.fill()

    if (pressFlash > 0) {
      const flash = ctx.createLinearGradient(drawX, drawY, drawX, drawY + drawHeight)
      flash.addColorStop(0, `rgba(255,255,255,${0.52 * pressFlash})`)
      flash.addColorStop(0.45, `rgba(255,255,255,${0.22 * pressFlash})`)
      flash.addColorStop(1, `rgba(255,255,255,${0.02 * pressFlash})`)
      roundedRect(ctx, drawX + 1, drawY + 1, Math.max(0, drawWidth - 2), drawHeight - 2, 3)
      ctx.fillStyle = flash
      ctx.fill()
    }
  } else if (isDisabled) {
    const shade = ctx.createLinearGradient(drawX, drawY, drawX, drawY + drawHeight)
    shade.addColorStop(0, 'rgba(0,0,0,0.22)')
    shade.addColorStop(0.55, 'rgba(0,0,0,0.1)')
    shade.addColorStop(1, 'rgba(0,0,0,0.28)')
    roundedRect(ctx, drawX + 1, drawY + 1, Math.max(0, drawWidth - 2), drawHeight - 2, 3)
    ctx.fillStyle = shade
    ctx.fill()
  }

  if (settings.showKeyLabels && (settings.keyLabelMode !== 'finger-hint' || drawActive)) drawWhiteLabel(ctx, rect, drawActive)
}

function drawWhiteLabel(ctx: CanvasRenderingContext2D, rect: KeyRect, isActive = active(rect.key.noteId)) {
  const { key, x, width, height } = rect
  const label = keyboardLabel(key.noteId)
  if (!label) return

  const baseFontSize = 16
  const fontSize = baseFontSize + settings.keyLabelSize * 2
  ctx.save()
  ctx.font = `700 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelY = height * (isActive ? 0.93 : 0.9)
  const strokeStyle = isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,1)'
  const fillStyle = isActive ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.9)'
  drawTextSprite(ctx, {
    key: `keyboard:white:${label}:${fontSize}:${strokeStyle}:${fillStyle}`,
    text: label,
    font: `700 ${fontSize}px sans-serif`,
    lineWidth: 3,
    strokeStyle,
    fillStyle,
    x: x + width / 2,
    y: labelY,
    baseline: 'middle',
  })
  ctx.restore()
}

function drawBlackKey(ctx: CanvasRenderingContext2D, rect: KeyRect, isDown = active(rect.key.noteId), isDisabled = isKeyDisabled(rect.key.noteId), pressFlash = 0) {
  const { key, x, y, width, height } = rect
  const drawDown = isDown && !isDisabled
  const accent = activeColor(key.noteId)

  // =========================
  // 1) SLOT NGOÀI
  // =========================
  const slotX = Math.round(x) + 0.5
  const slotY = Math.round(y) + 0.5
  const slotW = Math.max(10, Math.round(width) - 1)
  const slotH = Math.max(24, Math.round(height) - 1)

  ctx.save()

  // =========================
  // 2) BODY PHÍM
  // =========================
  const gapX = Math.max(2, Math.round(slotW * 0.09))
  const gapBottom = Math.max(2, Math.round(slotH * 0.025))

  const pressOffset = drawDown ? 1.3 : 0

  const bx = slotX + gapX - 0.5
  const by = slotY + pressOffset
  const bw = slotW - gapX * 2 + 1
  const bh = slotH - pressOffset - gapBottom + 2

  // Shadow ngoài thân phím
  ctx.shadowColor = drawDown ? 'rgba(0,0,0,0.15)' : isDisabled ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = drawDown ? 1 : isDisabled ? 1 : 4
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = drawDown ? 1 : isDisabled ? 0.5 : 2

  const img = drawDown ? blackKeyPressedImage : blackKeyRaisedImage
  ctx.drawImage(img, bx, by, bw, bh)

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  if (drawDown) {
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = accent
    ctx.beginPath()
    pathRoundedRect(ctx, bx, by, bw, bh, 3)
    ctx.clip()
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  } else if (isDisabled) {
    // Optional: make it darker if disabled
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    pathRoundedRect(ctx, bx, by, bw, bh, 3)
    ctx.clip()
    ctx.fill()
  }

  if (drawDown && pressFlash > 0) {
    ctx.beginPath()
    pathRoundedRect(ctx, bx + 1, by + 1, Math.max(0, bw - 2), Math.max(0, bh - 2), 3)
    const flash = ctx.createLinearGradient(bx, by, bx, by + bh)
    flash.addColorStop(0, `rgba(255,255,255,${0.48 * pressFlash})`)
    flash.addColorStop(0.42, `rgba(255,255,255,${0.18 * pressFlash})`)
    flash.addColorStop(1, `rgba(255,255,255,${0.03 * pressFlash})`)
    ctx.fillStyle = flash
    ctx.fill()
  }

  if (settings.showKeyLabels && (settings.keyLabelMode !== 'finger-hint' || drawDown)) drawBlackLabel(ctx, rect, drawDown)

  ctx.restore()
}

function drawBlackLabel(ctx: CanvasRenderingContext2D, rect: KeyRect, isActive = active(rect.key.noteId)) {
  const { key, x, width, height } = rect
  const label = keyboardLabel(key.noteId)
  if (!label) return

  const baseFontSize = 9
  const fontSize = baseFontSize + settings.keyLabelSize
  ctx.save()
  ctx.font = `700 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelY = height * (isActive ? 0.83 : 0.8)
  const strokeStyle = isActive ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.75)'
  const fillStyle = isActive ? 'rgba(255,255,255,0.92)' : 'rgba(245,245,245,0.9)'
  drawTextSprite(ctx, {
    key: `keyboard:black:${label}:${fontSize}:${strokeStyle}:${fillStyle}`,
    text: label,
    font: `700 ${fontSize}px sans-serif`,
    lineWidth: 2.5,
    strokeStyle,
    fillStyle,
    x: x + width / 2,
    y: labelY,
    baseline: 'middle',
  })
  ctx.restore()
}

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function pathBlackKeyLip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const inset = Math.max(2, w * 0.14)
  const sideCurve = Math.min(4.5, h * 0.6)

  ctx.beginPath()

  // đáy trái
  ctx.moveTo(x + 1, y + h)

  // cạnh trái đi lên
  ctx.lineTo(x + 1, y + sideCurve + 1)

  // cong vát vào
  ctx.quadraticCurveTo(x + 1, y + 1, x + inset, y + 1)

  // ngang trên
  ctx.lineTo(x + w - inset, y + 1)

  // cong vát vào bên phải
  ctx.quadraticCurveTo(x + w - 1, y + 1, x + w - 1, y + sideCurve + 1)

  // cạnh phải đi xuống
  ctx.lineTo(x + w - 1, y + h)

  ctx.closePath()
}

function shadeColor(hex: string, percent: number) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')

  const num = parseInt(h, 16)
  const amt = Math.round(2.55 * percent)

  const r = Math.max(0, Math.min(255, (num >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt))

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

type TextSpriteOptions = {
  key: string
  text: string
  font: string
  lineWidth: number
  strokeStyle: string
  fillStyle: string
  x: number
  y: number
  baseline: CanvasTextBaseline
}

function drawTextSprite(ctx: CanvasRenderingContext2D, options: TextSpriteOptions) {
  const padding = Math.max(4, Math.ceil(options.lineWidth) + 2)
  const sprite = keyboardLabelSprites.getOrCreate(options.key, () => {
    const measuringCanvas = createSpriteCanvas(1, 1)
    const measuring = measuringCanvas.getContext('2d')
    if (!measuring) return measuringCanvas
    measuring.font = options.font
    const metrics = measuring.measureText(options.text)
    const fontSize = Number(options.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 16)
    const textWidth = Math.ceil(metrics.width)
    const textHeight = Math.ceil(
      (metrics.actualBoundingBoxAscent || fontSize * 0.8) +
      (metrics.actualBoundingBoxDescent || fontSize * 0.25)
    )
    const canvas = createSpriteCanvas(textWidth + padding * 2, textHeight + padding * 2)
    const spriteCtx = canvas.getContext('2d')
    if (!spriteCtx) return canvas
    spriteCtx.font = options.font
    spriteCtx.textAlign = 'center'
    spriteCtx.textBaseline = 'middle'
    spriteCtx.lineJoin = 'round'
    spriteCtx.miterLimit = 2
    spriteCtx.lineWidth = options.lineWidth
    spriteCtx.strokeStyle = options.strokeStyle
    spriteCtx.fillStyle = options.fillStyle
    spriteCtx.strokeText(options.text, canvas.width / 2, canvas.height / 2)
    spriteCtx.fillText(options.text, canvas.width / 2, canvas.height / 2)
    return canvas
  })

  const y = options.baseline === 'alphabetic' ? options.y - sprite.height / 2 : options.y
  ctx.drawImage(sprite, options.x - sprite.width / 2, y - sprite.height / 2)
}

function getKeyboardBaseCacheKey() {
  const range = keyboardRange.value
  return [
    Math.round(logicalWidth),
    Math.round(logicalHeight),
    Math.round(blackKeyHeight()),
    `${range.lowNote}-${range.highNote}`,
    props.transparentBackground ? 'transparent' : 'opaque',
    settings.showKeyLabels,
    settings.keyLabelMode === 'finger-hint' ? 'finger-hint-base' : settings.keyLabelMode,
    settings.keyLabelSize,
    currentKeySignatureAccidentals(),
  ].join(':')
}

function invalidateKeyboardBaseLayer() {
  keyboardBaseCanvas = null
  keyboardBaseKey = ''
  keyboardBlackLayerCanvas = null
  keyboardBlackLayerKey = ''
}

function drawBlackKeyLayer(ctx: CanvasRenderingContext2D) {
  for (const k of blackKeys) {
    const { x, y, width, height } = keyRect(k)
    const slotX = Math.round(x) + 0.5
    const slotY = Math.round(y) + 0.5
    const slotW = Math.max(10, Math.round(width) - 1)
    const slotH = Math.max(24, Math.round(height) - 1)

    pathRoundedRect(ctx, slotX, slotY, slotW, slotH, 3)
    ctx.fillStyle = '#000'
    ctx.fill()
  }

  drawHitLine(ctx)
  for (const key of blackKeys) drawBlackKey(ctx, keyRect(key), false, isKeyDisabled(key.noteId))
}

function buildKeyboardBaseLayer(cacheKey: string) {
  const canvas = createSpriteCanvas(logicalWidth, logicalHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (!props.transparentBackground) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, logicalWidth, logicalHeight)
  }
  for (const key of whiteKeys) drawWhiteKey(ctx, keyRect(key), false, isKeyDisabled(key.noteId))
  drawBlackKeyLayer(ctx)
  keyboardBaseCanvas = canvas
  keyboardBaseKey = cacheKey
  return canvas
}

function ensureKeyboardBaseLayer() {
  const cacheKey = getKeyboardBaseCacheKey()
  if (keyboardBaseCanvas && keyboardBaseKey === cacheKey) return keyboardBaseCanvas
  return buildKeyboardBaseLayer(cacheKey)
}

function ensureKeyboardBlackLayer() {
  const cacheKey = getKeyboardBaseCacheKey()
  if (keyboardBlackLayerCanvas && keyboardBlackLayerKey === cacheKey) return keyboardBlackLayerCanvas
  const canvas = createSpriteCanvas(logicalWidth, logicalHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, logicalWidth, logicalHeight)
  drawBlackKeyLayer(ctx)
  keyboardBlackLayerCanvas = canvas
  keyboardBlackLayerKey = cacheKey
  return canvas
}

function drawHitLine(ctx: CanvasRenderingContext2D) {
  drawKeyboardHitLine(ctx, logicalWidth)
}

function drawMelodyWaitHighlight(ctx: CanvasRenderingContext2D) {
  const note = melodyWaitNote()
  if (!note) return
  const key = keys.find(item => item.noteId === note.noteId)
  if (!key) return
  const rect = keyRect(key)
  const radius = Math.max(5, Math.min(rect.width, rect.height) * (key.black ? 0.22 : 0.16))
  const cx = rect.x + rect.width / 2
  const cy = key.black ? rect.y + rect.height * 0.52 : rect.y + rect.height * 0.5
  const color = melodyWaitColor()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.shadowBlur = 0
  ctx.fill()

  ctx.lineWidth = Math.max(2, radius * 0.18)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.42)'
  ctx.stroke()
  ctx.restore()
}

function draw() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  if (!logicalWidth || !logicalHeight) resizeCanvas()
  const nowMs = performance.now()
  updatePressFlashes(nowMs)
  animatingPressFlash = false

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, logicalWidth, logicalHeight)
  const baseLayer = ensureKeyboardBaseLayer()
  if (baseLayer) {
    ctx.drawImage(baseLayer, 0, 0, logicalWidth, logicalHeight)
  }

  const activeWhiteKeys = whiteKeys.filter(key => !isKeyDisabled(key.noteId) && active(key.noteId))
  for (const key of activeWhiteKeys) {
    const release = forcingRelease(key.noteId, nowMs)
    const flash = release ? 0 : pressFlashStrength(key.noteId, nowMs)
    if (release || flash > 0) animatingPressFlash = true
    drawWhiteKey(ctx, keyRect(key), !release, false, flash)
  }

  if (activeWhiteKeys.length > 0) {
    // Active white keys are drawn above the cached base, so restore the cached hit line and black-key layer on top.
    const blackLayer = ensureKeyboardBlackLayer()
    if (blackLayer) ctx.drawImage(blackLayer, 0, 0, logicalWidth, logicalHeight)
    for (const key of blackKeys) {
      const isActive = active(key.noteId)
      if (!isActive || isKeyDisabled(key.noteId)) continue
      const release = forcingRelease(key.noteId, nowMs)
      const flash = release ? 0 : pressFlashStrength(key.noteId, nowMs)
      if (release || flash > 0) animatingPressFlash = true
      drawBlackKey(ctx, keyRect(key), !release, false, flash)
    }
  } else {
    for (const key of blackKeys) {
      if (!isKeyDisabled(key.noteId) && active(key.noteId)) {
        const release = forcingRelease(key.noteId, nowMs)
        const flash = release ? 0 : pressFlashStrength(key.noteId, nowMs)
        if (release || flash > 0) animatingPressFlash = true
        drawBlackKey(ctx, keyRect(key), !release, false, flash)
      }
    }
  }

  drawMelodyWaitHighlight(ctx)
}

function requestDraw() {
  dirty = true
  if (rafId !== null) return
  rafId = requestAnimationFrame(drawFrame)
}

function drawFrame() {
  rafId = null
  if (!dirty) return
  
  const now = performance.now()
  if (settings.advancedReduceAnimations && now - lastFrameMs < 33.0) {
    if (animatingPressFlash) requestDraw()
    // leave dirty = true so it will redraw eventually
    return
  }
  lastFrameMs = now

  dirty = false
  draw()
  if (animatingPressFlash) requestDraw()
}

function keyboardVisualKey() {
  const session = player.session
  if (!session) return ''
  
  const freePlayKey = session.mode === 'listen' 
    ? Math.round(freePlay.viewUs ?? freePlay.recordingDurationUs)
    : ''

  return [
    session.keyboardVisualVersion,
    props.previewActiveFromTimeline ? Math.round(session.currentUs) : '',
    freePlayKey,
    settings.keyLabelMode === 'finger-hint' ? session.fingeringVersion : 0,
    session.keyboardRange ? `${session.keyboardRange.lowNote}:${session.keyboardRange.highNote}` : '',
  ].join('|')
}

watch(keyboardVisualKey, requestDraw)
watch(() => {
  const range = keyboardRange.value
  return `${range.lowNote}:${range.highNote}`
}, () => {
  invalidateKeyboardBaseLayer()
  requestDraw()
})
watch(() => [
  settings.showKeyLabels,
  settings.keyLabelMode,
  settings.keyLabelSize,
  settings.keyboardRangeMode,
  props.transparentBackground,
  props.previewActiveFromTimeline,
], () => {
  invalidateKeyboardBaseLayer()
  requestDraw()
})

function pointFromEvent(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  return { x, y, inside: x >= 0 && x <= rect.width && y >= 0 && y <= rect.height }
}

function hitTest(event: PointerEvent) {
  const point = pointFromEvent(event)
  if (!point || !point.inside) return null
  for (const key of blackKeys) {
    const rect = keyRect(key)
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
      return isKeyDisabled(key.noteId) ? null : key.noteId
    }
  }
  for (const key of whiteKeys) {
    const rect = keyRect(key)
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) {
      return isKeyDisabled(key.noteId) ? null : key.noteId
    }
  }
  return null
}

function releaseNote(noteId: number, source: 'pointer' | 'computer' = 'pointer') {
  player.noteInput(noteId, false, { source })
  player.session?.activeNotes.delete(noteId)
  player.session?.activeNoteHands.delete(noteId)
}

function releasePointer(pointerId: number) {
  const noteId = pointerNotes.get(pointerId)
  if (noteId === undefined) return
  releaseNote(noteId)
  pointerNotes.delete(pointerId)
}

function releaseAllPointers() {
  for (const pointerId of [...pointerNotes.keys()]) releasePointer(pointerId)
}

function releaseComputerKey(key: string) {
  if (!pressedComputerKeys.has(key)) return
  const noteId = getVirtualPianoNoteIdFromKey(key)
  pressedComputerKeys.delete(key)
  if (noteId !== null) releaseNote(noteId, 'computer')
}

function releaseAllComputerKeys() {
  for (const key of [...pressedComputerKeys]) releaseComputerKey(key)
}

function releaseAllInput() {
  releaseAllPointers()
  releaseAllComputerKeys()
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true
  const editable = target.closest('[contenteditable]')
  return editable !== null && editable.getAttribute('contenteditable') !== 'false'
}

function virtualPianoEnabled() {
  return settings.showKeyLabels && settings.keyLabelMode === 'virtual-piano'
}

function normalizeComputerKey(key: string) {
  return key.toLowerCase()
}

function onComputerKeyDown(event: KeyboardEvent) {
  if (!virtualPianoEnabled() || isTypingTarget(event.target) || event.repeat) return
  const key = normalizeComputerKey(event.key)
  const noteId = getVirtualPianoNoteIdFromKey(key)
  if (noteId === null || pressedComputerKeys.has(key)) return
  event.preventDefault()
  pressedComputerKeys.add(key)
  player.noteInput(noteId, true, { source: 'computer' })
}

function onComputerKeyUp(event: KeyboardEvent) {
  const key = normalizeComputerKey(event.key)
  if (!pressedComputerKeys.has(key)) return
  event.preventDefault()
  releaseComputerKey(key)
}

function onPointerDown(event: PointerEvent) {
  event.preventDefault()
  const canvas = canvasRef.value
  const noteId = hitTest(event)
  if (!canvas || noteId === null) return
  canvas.setPointerCapture(event.pointerId)
  player.noteInput(noteId, true, { source: 'pointer' })
  pointerNotes.set(event.pointerId, noteId)
}

function onPointerMove(event: PointerEvent) {
  if (!pointerNotes.has(event.pointerId)) return
  event.preventDefault()
  const nextNoteId = hitTest(event)
  const currentNoteId = pointerNotes.get(event.pointerId)
  if (currentNoteId === undefined || nextNoteId === currentNoteId) return
  releaseNote(currentNoteId)
  if (nextNoteId === null) {
    pointerNotes.delete(event.pointerId)
    return
  }
  player.noteInput(nextNoteId, true, { source: 'pointer' })
  pointerNotes.set(event.pointerId, nextNoteId)
}

function onPointerUp(event: PointerEvent) {
  event.preventDefault()
  releasePointer(event.pointerId)
  const canvas = canvasRef.value
  if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
}

function onLostPointerCapture(event: PointerEvent) {
  releasePointer(event.pointerId)
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') releaseAllInput()
}

onMounted(() => {
  resizeCanvas()
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
      requestDraw()
    })
    resizeObserver.observe(canvasRef.value)
  }
  window.addEventListener('blur', releaseAllInput)
  window.addEventListener('keydown', onComputerKeyDown)
  window.addEventListener('keyup', onComputerKeyUp)
  document.addEventListener('visibilitychange', onVisibilityChange)
  requestDraw()
})

onBeforeUnmount(() => {
  releaseAllInput()
  window.removeEventListener('blur', releaseAllInput)
  window.removeEventListener('keydown', onComputerKeyDown)
  window.removeEventListener('keyup', onComputerKeyUp)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  invalidateKeyboardBaseLayer()
  keyboardLabelSprites.clear()
})
</script>

<template>
  <div class="keyboard" :class="{ 'keyboard--transparent': props.transparentBackground }" @mouseleave="releaseAllPointers">
    <canvas
      ref="canvasRef"
      class="keyboard-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @lostpointercapture="onLostPointerCapture"
    ></canvas>
  </div>
</template>

<style scoped>
.keyboard { position: relative; height: var(--keyboard-height, 150px); user-select: none; touch-action: none; background: #000000; }
.keyboard--transparent { background: transparent; }
.keyboard-canvas { display: block; width: 100%; height: 100%; touch-action: none; }
</style>
