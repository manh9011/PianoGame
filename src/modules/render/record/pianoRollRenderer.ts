import { HAND_COLORS, HAND_HIT_COLORS } from '../../game/handAssignment'
import { FLAT_GRAY, MISSED_NOTE_COLOR, TRACK_INVISIBLE_COLOR } from '../../game/trackProperties'
import { createPianoKeys, WHITE_KEY_COUNT } from '../pianoGeometry'
import { formatKeySignature, getNoteLabel, notePitchClass } from '../pianoLabels'
import { drawRollHitLine, ROLL_HIT_LINE_HEIGHT as HIT_LINE_HEIGHT } from '../hitLineRenderer'
import { drawImpactParticlesStatelessWithSprites } from '../impactParticlesRenderer'
import { layoutNotes, type LaidOutNote } from '../pianoRollLayout'
import type { RecordRenderableNote, RecordRenderImages, RecordRenderScene, RecordRenderVisualOptions } from './recordRenderModel'

const PIANO_ROLL_BACKGROUND = '#303030'
const NOTE_BODY_PAD_X = 8
const NOTE_BODY_PAD_Y = 10
const pianoKeys = createPianoKeys()
const verticalGridLines = [
  { x: 0, octave: true },
  ...pianoKeys
    .filter(key => !key.black && (notePitchClass(key.noteId) === 0 || notePitchClass(key.noteId) === 5))
    .map(key => ({ x: key.x, octave: notePitchClass(key.noteId) === 0 })),
].filter((line, index, lines) => line.x >= 0 && line.x <= WHITE_KEY_COUNT && lines.findIndex(item => item.x === line.x) === index)

export interface PianoRollRenderInput {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  width: number
  height: number
  currentUs: number
  scene: RecordRenderScene
  visuals: RecordRenderVisualOptions
  images?: RecordRenderImages
  keySignatureAccidentals?: number
  drawBackground?: boolean
  drawContent?: boolean
  drawImpacts?: boolean
  drawLogo?: boolean
}

type ExportRenderableNote = RecordRenderableNote & { start: number; end: number; channel: number; state: 'waiting' | 'hit' | 'missed' }
type ExportLayoutNote = LaidOutNote<ExportRenderableNote>

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

function drawImageCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageRatio = image.width / image.height
  const targetRatio = width / height
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = image.width
  let sourceHeight = image.height

  if (imageRatio > targetRatio) {
    sourceWidth = image.height * targetRatio
    sourceX = (image.width - sourceWidth) / 2
  } else {
    sourceHeight = image.width / targetRatio
    sourceY = (image.height - sourceHeight) / 2
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

function trackForId(trackId: number, scene: RecordRenderScene) {
  return scene.tracks.find(track => track.trackId === trackId) ?? null
}

function noteVisible(note: Pick<RecordRenderableNote, 'trackId'>, scene: RecordRenderScene) {
  const track = trackForId(note.trackId, scene)
  return track?.color !== TRACK_INVISIBLE_COLOR && track?.mode !== 'playedButHidden' && track?.mode !== 'notPlayed'
}

function noteColor(note: Pick<RecordRenderableNote, 'trackId' | 'hand'> & { state?: 'waiting' | 'hit' | 'missed' }, scene: RecordRenderScene) {
  const track = trackForId(note.trackId, scene)
  if (!track || track.mode === 'notPlayed') return FLAT_GRAY
  if (note.state === 'missed') return MISSED_NOTE_COLOR
  if (note.state === 'hit') return track.hitColor || HAND_HIT_COLORS[note.hand]
  return track.color || HAND_COLORS[note.hand]
}

function currentKeySignatureLabel(currentUs: number, scene: RecordRenderScene) {
  let currentKey: string | undefined
  let currentScale: string | undefined
  let currentLabel: string | undefined
  for (const signature of scene.keySignatures) {
    if (signature.timeUs > currentUs) break
    currentKey = signature.key
    currentScale = signature.scale
    currentLabel = signature.label
  }
  return formatKeySignature(currentKey, currentScale, undefined, currentLabel)
}

function drawGrid(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number, currentUs: number, scene: RecordRenderScene) {
  for (const line of verticalGridLines) {
    const x = line.x * width / WHITE_KEY_COUNT
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.strokeStyle = line.octave ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.18)'
    ctx.lineWidth = line.octave ? 1.4 : 1
    ctx.stroke()
  }

  const windowUs = scene.showDuration * 1_000_000
  for (let index = 0; index < scene.measureGridUs.length; index += 1) {
    const us = scene.measureGridUs[index]
    if (us < currentUs || us > currentUs + windowUs) continue
    const y = height - ((us - currentUs) / windowUs) * height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
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
}

function drawCurrentKey(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, height: number, currentUs: number, scene: RecordRenderScene) {
  const text = currentKeySignatureLabel(currentUs, scene)
  const x = 8
  const y = height - HIT_LINE_HEIGHT - 30
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

function drawHitLine(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number, isStopped: boolean) {
  drawRollHitLine(ctx, width, height, isStopped)
}

function drawNoteBody(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, fillColor: string) {
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

function fingerBadgeColor(finger: number | null | undefined, visuals: RecordRenderVisualOptions) {
  if (!visuals.showColoredFingerHints) return '#ffffff'
  switch (finger) {
    case 1: return '#22C55E'
    case 2: return '#FACC15'
    case 3: return '#A855F7'
    case 4: return '#3B82F6'
    case 5: return '#EF4444'
    default: return '#ffffff'
  }
}

function drawFingerBadge(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, note: ExportLayoutNote, visuals: RecordRenderVisualOptions, belowNote = false) {
  if (!note.finger) return
  const radius = Math.max(9, Math.min(15, note.width * 0.32))
  const x = note.x + note.width / 2
  const y = belowNote
    ? note.initialY + radius + 6
    : Math.max(note.y - note.height + radius + 4, note.initialY - radius - 5)
  const size = radius * 2
  ctx.save()
  ctx.fillStyle = fingerBadgeColor(note.finger, visuals)
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

function drawNoteLabel(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, note: ExportLayoutNote, text: string, visuals: RecordRenderVisualOptions) {
  const baseFontSize = 16
  const fontSize = baseFontSize + visuals.noteLabelSize * 2
  ctx.save()
  ctx.font = `600 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.82)'
  ctx.fillStyle = '#ffffff'
  ctx.strokeText(text, note.x + note.width / 2, note.initialY - 6)
  ctx.fillText(text, note.x + note.width / 2, note.initialY - 6)
  ctx.restore()
}

function drawNote(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, note: ExportLayoutNote, scene: RecordRenderScene, visuals: RecordRenderVisualOptions) {
  const x = note.x
  const y = note.y - note.height
  const w = Math.max(1, Math.round(note.width))
  const h = Math.max(1, Math.round(note.height))
  const fillColor = noteColor(note, scene)
  drawNoteBody(ctx, x, y, w, h, fillColor)
  if (visuals.showFingerHints && note.finger && visuals.noteLabelMode !== 'finger-hint') drawFingerBadge(ctx, note, visuals, true)
}

function drawImpactParticles(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  notes: ExportLayoutNote[],
  currentUs: number,
  height: number,
  _scene: RecordRenderScene,
  yOffset = 0,
) {
  drawImpactParticlesStatelessWithSprites(ctx, notes, currentUs, height, yOffset)
}

function layoutVisibleNotes(width: number, height: number, currentUs: number, scene: RecordRenderScene) {
  return layoutNotes(
    scene.notes.map(note => ({
      ...note,
      start: note.startUs,
      end: note.endUs,
      channel: 0,
      state: 'waiting' as const,
    })),
    currentUs,
    scene.showDuration,
    width,
    height,
  ).filter(note => noteVisible(note, scene))
}

function renderBackground(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = PIANO_ROLL_BACKGROUND
  ctx.fillRect(0, 0, width, height)
}

function renderLogo(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, _height: number, visuals: RecordRenderVisualOptions, images?: RecordRenderImages) {
  if (!visuals.logoEnabled || !images?.logo) return
  const size = 40
  const margin = 18
  ctx.save()
  ctx.globalAlpha = 0.88
  drawImageCover(ctx, images.logo, width - size - margin, margin, size, size)
  ctx.restore()
}

export function renderPianoRoll({
  ctx,
  width,
  height,
  currentUs,
  scene,
  visuals,
  images,
  keySignatureAccidentals = 0,
  drawBackground = true,
  drawContent = true,
  drawImpacts = false,
  drawLogo = true,
}: PianoRollRenderInput) {
  if (drawBackground) {
    ctx.clearRect(0, 0, width, height)
    renderBackground(ctx, width, height)
  }

  const visibleNotes = visuals.showFallingNotes ? layoutVisibleNotes(width, height, currentUs, scene) : []

  if (drawContent) {
    if (visuals.showGrid) drawGrid(ctx, width, height, currentUs, scene)
    drawCurrentKey(ctx, height, currentUs, scene)

    if (visuals.showFallingNotes) {
      for (const note of visibleNotes) {
        drawNote(ctx, note, scene, visuals)
      }

      if (visuals.showNoteLabels && visuals.noteLabelMode !== 'none') {
        for (const note of visibleNotes) {
          if (visuals.noteLabelMode === 'finger-hint') {
            drawFingerBadge(ctx, note, visuals, false)
            continue
          }
          const text = getNoteLabel(visuals.noteLabelMode, note.noteId, keySignatureAccidentals, note.finger)
          if (text) drawNoteLabel(ctx, note, text, visuals)
        }
      }
    }

    drawHitLine(ctx, width, height, false)
  }

  if (drawImpacts && visuals.showFallingNotes) drawImpactParticles(ctx, visibleNotes, currentUs, height, scene)
  if (drawLogo) renderLogo(ctx, width, height, visuals, images)
}

export function renderPianoRollImpactParticles({ ctx, width, height, currentUs, scene, visuals, yOffset = 0 }: PianoRollRenderInput & { yOffset?: number }) {
  if (!visuals.showFallingNotes) return
  const visibleNotes = layoutVisibleNotes(width, height, currentUs, scene)
  drawImpactParticles(ctx, visibleNotes, currentUs, height, scene, yOffset)
}