import { getKeyboardLabel } from '../pianoLabels'
import { createPianoKeys, WHITE_KEY_COUNT, type PianoKey } from '../pianoGeometry'
import { isNoteInRange } from '../keyboardRange'
import { drawKeyboardHitLine, keyboardWhiteKeyTopOffset } from '../hitLineRenderer'
import type { LabelMode } from '../../../types/settings'
import type { RecordRenderImages, RecordRenderScene, RecordRenderVisualOptions } from './recordRenderModel'

const keys = createPianoKeys()
const whiteKeys = keys.filter(key => !key.black)
const blackKeys = keys.filter(key => key.black)
const BLACK_KEY_HEIGHT_RATIO = 95 / 150

export interface PianoKeyboardRenderInput {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  width: number
  height: number
  scene: RecordRenderScene
  visuals: RecordRenderVisualOptions
  activeNotes?: { noteId: number, trackId: number }[]
  keySignatureAccidentals?: number
  images?: RecordRenderImages
}

interface KeyRect { key: PianoKey; x: number; y: number; width: number; height: number }

function roundedRect(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function pathRoundedRect(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundedRect(ctx, x, y, w, h, r)
}

function pathBlackKeyLip(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const inset = Math.max(2, w * 0.14)
  const sideCurve = Math.min(4.5, h * 0.6)
  ctx.beginPath()
  ctx.moveTo(x + 1, y + h)
  ctx.lineTo(x + 1, y + sideCurve + 1)
  ctx.quadraticCurveTo(x + 1, y + 1, x + inset, y + 1)
  ctx.lineTo(x + w - inset, y + 1)
  ctx.quadraticCurveTo(x + w - 1, y + 1, x + w - 1, y + sideCurve + 1)
  ctx.lineTo(x + w - 1, y + h)
  ctx.closePath()
}

function shadeColor(hex: string, percent: number) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(char => char + char).join('')
  const num = Number.parseInt(h, 16)
  if (!Number.isFinite(num)) return hex
  const amt = Math.round(2.55 * percent)
  const red = Math.max(0, Math.min(255, (num >> 16) + amt))
  const green = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt))
  const blue = Math.max(0, Math.min(255, (num & 0xff) + amt))
  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`
}

function keyRect(key: PianoKey, width: number, height: number): KeyRect {
  const unitWidth = width / WHITE_KEY_COUNT
  return {
    key,
    x: key.x * unitWidth,
    y: key.black ? 2 : 0,
    width: key.width * unitWidth,
    height: key.black ? height * BLACK_KEY_HEIGHT_RATIO : height,
  }
}

function noteActive(noteId: number, activeNotes: { noteId: number, trackId: number }[]) {
  return activeNotes.some(n => n.noteId === noteId)
}

function isKeyDisabled(noteId: number, scene: RecordRenderScene) {
  return !isNoteInRange(noteId, scene.keyboardRange)
}

function activeColor(noteId: number, activeNotes: { noteId: number, trackId: number }[], scene: RecordRenderScene) {
  const activeNote = activeNotes.find(n => n.noteId === noteId)
  if (!activeNote) return '#888a85'
  return scene.tracks.find(track => track.trackId === activeNote.trackId)?.color ?? '#888a85'
}

function keyboardLabel(mode: LabelMode | 'none', noteId: number, keySignatureAccidentals: number) {
  if (mode === 'none' || mode === 'finger-hint') return null
  return getKeyboardLabel(mode, noteId, keySignatureAccidentals)
}

function drawLabel(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: KeyRect,
  mode: LabelMode | 'none',
  sizeOffset: number,
  keySignatureAccidentals: number,
  isActive: boolean,
) {
  const label = keyboardLabel(mode, rect.key.noteId, keySignatureAccidentals)
  if (!label) return
  const baseFontSize = rect.key.black ? 9 : 16
  const fontSize = rect.key.black ? baseFontSize + sizeOffset : baseFontSize + sizeOffset * 2
  const labelY = rect.height * (isActive ? rect.key.black ? 0.83 : 0.93 : rect.key.black ? 0.8 : 0.9)
  ctx.save()
  ctx.font = `700 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = rect.key.black ? 2.5 : 3
  ctx.strokeStyle = rect.key.black
    ? isActive ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.75)'
    : isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,1)'
  ctx.fillStyle = rect.key.black
    ? isActive ? 'rgba(255,255,255,0.92)' : 'rgba(245,245,245,0.9)'
    : isActive ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.9)'
  ctx.strokeText(label, rect.x + rect.width / 2, labelY)
  ctx.fillText(label, rect.x + rect.width / 2, labelY)
  ctx.restore()
}

function drawWhiteKey(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: KeyRect,
  scene: RecordRenderScene,
  visuals: RecordRenderVisualOptions,
  activeNotes: { noteId: number, trackId: number }[],
  keySignatureAccidentals: number,
) {
  const isActive = noteActive(rect.key.noteId, activeNotes)
  const isDisabled = isKeyDisabled(rect.key.noteId, scene)
  const drawActive = isActive && !isDisabled
  const drawX = rect.x + 0.25
  const drawY = rect.y - keyboardWhiteKeyTopOffset()
  const drawWidth = Math.max(0, rect.width - 0.5)
  const drawHeight = rect.height - 0.5 - drawY
  const fill = ctx.createLinearGradient(drawX, drawY, drawX + drawWidth, drawY)

  if (drawActive) {
    const color = activeColor(rect.key.noteId, activeNotes, scene)
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
  } else if (isDisabled) {
    const shade = ctx.createLinearGradient(drawX, drawY, drawX, drawY + drawHeight)
    shade.addColorStop(0, 'rgba(0,0,0,0.22)')
    shade.addColorStop(0.55, 'rgba(0,0,0,0.1)')
    shade.addColorStop(1, 'rgba(0,0,0,0.28)')
    roundedRect(ctx, drawX + 1, drawY + 1, Math.max(0, drawWidth - 2), drawHeight - 2, 3)
    ctx.fillStyle = shade
    ctx.fill()
  }

  if (visuals.showKeyLabels) drawLabel(ctx, rect, visuals.keyLabelMode, visuals.keyLabelSize, keySignatureAccidentals, drawActive)
}

function drawBlackKey(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rect: KeyRect,
  scene: RecordRenderScene,
  visuals: RecordRenderVisualOptions,
  activeNotes: { noteId: number, trackId: number }[],
  keySignatureAccidentals: number,
  images?: RecordRenderImages,
) {
  const isActive = noteActive(rect.key.noteId, activeNotes)
  const isDisabled = isKeyDisabled(rect.key.noteId, scene)
  const drawDown = isActive && !isDisabled
  const accent = activeColor(rect.key.noteId, activeNotes, scene)
  const slotX = Math.round(rect.x) + 0.5
  const slotY = Math.round(rect.y) + 0.5
  const slotW = Math.max(10, Math.round(rect.width) - 1)
  const slotH = Math.max(24, Math.round(rect.height) - 1)
  const gapX = Math.max(2, Math.round(slotW * 0.09))
  const gapBottom = Math.max(2, Math.round(slotH * 0.025))
  const pressOffset = drawDown ? 1.3 : 0
  const bx = slotX + gapX - 0.5
  const by = slotY + pressOffset
  const bw = slotW - gapX * 2 + 1
  const bh = slotH - pressOffset - gapBottom + 2

  ctx.save()
  ctx.shadowColor = drawDown ? 'rgba(0,0,0,0.15)' : isDisabled ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = drawDown ? 1 : isDisabled ? 1 : 4
  ctx.shadowOffsetY = drawDown ? 1 : isDisabled ? 0.5 : 2

  const img = drawDown ? images?.blackKeyPressed : images?.blackKeyRaised
  if (img) {
    ctx.drawImage(img, bx, by, bw, bh)
  }

  ctx.shadowColor = 'transparent'

  if (drawDown) {
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = accent
    ctx.beginPath()
    pathRoundedRect(ctx, bx, by, bw, bh, 3)
    ctx.clip()
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  } else if (isDisabled) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    pathRoundedRect(ctx, bx, by, bw, bh, 3)
    ctx.clip()
    ctx.fill()
  }

  if (visuals.showKeyLabels) drawLabel(ctx, rect, visuals.keyLabelMode, visuals.keyLabelSize, keySignatureAccidentals, drawDown)
  ctx.restore()
}

function drawHitLine(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number) {
  drawKeyboardHitLine(ctx, width)
}

export function renderPianoKeyboard({
  ctx,
  width,
  height,
  scene,
  visuals,
  activeNotes = [],
  keySignatureAccidentals = 0,
  images,
}: PianoKeyboardRenderInput) {
  ctx.clearRect(0, 0, width, height)

  for (const key of whiteKeys) {
    drawWhiteKey(ctx, keyRect(key, width, height), scene, visuals, activeNotes, keySignatureAccidentals)
  }

  for (const key of blackKeys) {
    const rect = keyRect(key, width, height)
    const slotX = Math.round(rect.x) + 0.5
    const slotY = Math.round(rect.y) + 0.5
    const slotW = Math.max(10, Math.round(rect.width) - 1)
    const slotH = Math.max(24, Math.round(rect.height) - 1)
    pathRoundedRect(ctx, slotX, slotY, slotW, slotH, 3)
    ctx.fillStyle = '#000'
    ctx.fill()
  }

  drawHitLine(ctx, width)
  for (const key of blackKeys) {
    drawBlackKey(ctx, keyRect(key, width, height), scene, visuals, activeNotes, keySignatureAccidentals, images)
  }
}
