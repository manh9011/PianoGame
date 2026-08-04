import { renderPianoKeyboard } from './pianoKeyboardRenderer'
import { renderPianoRoll } from './pianoRollRenderer'
import { WHITE_KEY_COUNT } from '../pianoGeometry'
import { TRACK_INVISIBLE_COLOR } from '../../game/trackProperties'
import type { RecordRenderImages, RecordRenderScene, RecordRenderVisualOptions } from './recordRenderModel'

const WHITE_KEY_ASPECT_RATIO = 150 / 23.5
const INTRO_TOTAL_US = 3_000_000
const INTRO_START_US = -5_500_000
const INTRO_END_US = INTRO_START_US + INTRO_TOTAL_US
const INTRO_IN_US = 600_000
const INTRO_HOLD_US = 1_500_000
const INTRO_OUT_US = INTRO_TOTAL_US - INTRO_IN_US - INTRO_HOLD_US
const PANEL_MAX_OPACITY = 0.9

function visibleTrack(trackId: number, scene: RecordRenderScene) {
  const track = scene.tracks.find(item => item.trackId === trackId)
  return track?.color !== TRACK_INVISIBLE_COLOR && track?.mode !== 'playedButHidden' && track?.mode !== 'notPlayed'
}

export interface ActiveRenderNote {
  noteId: number
  trackId: number
}

function activeNotesAt(currentUs: number, scene: RecordRenderScene): ActiveRenderNote[] {
  return scene.notes
    .filter(note => visibleTrack(note.trackId, scene) && note.startUs <= currentUs && note.endUs >= currentUs)
    .map(note => ({ noteId: note.noteId, trackId: note.trackId }))
}

function currentKeySignatureAccidentals(currentUs: number, scene: RecordRenderScene) {
  let current = 0
  for (const signature of scene.keySignatures) {
    if (signature.timeUs > currentUs) break
    current = signature.accidentals
  }
  return current
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

function drawSceneBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  visuals: RecordRenderVisualOptions,
  images?: RecordRenderImages,
) {
  ctx.fillStyle = '#303030'
  ctx.fillRect(0, 0, width, height)
  if (!images?.background) return
  drawImageCover(ctx, images.background, 0, 0, width, height)
  ctx.fillStyle = `rgba(48,48,48,${visuals.backgroundOpacity})`
  ctx.fillRect(0, 0, width, height)
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

function easeInCubic(progress: number) {
  return progress * progress * progress
}

function drawIntroOverlay(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number, currentUs: number, title: string) {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim()
  if (!normalizedTitle || currentUs < INTRO_START_US || currentUs >= INTRO_END_US) return

  const elapsedUs = Math.max(0, Math.min(INTRO_TOTAL_US, currentUs - INTRO_START_US))
  let panelOpacity = PANEL_MAX_OPACITY
  let titleOpacity = 1
  let translateX = 0

  if (elapsedUs < INTRO_IN_US) {
    const progress = clamp01(elapsedUs / INTRO_IN_US)
    const eased = easeOutCubic(progress)
    panelOpacity = lerp(0, PANEL_MAX_OPACITY, eased)
    titleOpacity = eased
    translateX = lerp(width * 1.1, 0, eased)
  } else if (elapsedUs >= INTRO_IN_US + INTRO_HOLD_US) {
    const progress = clamp01((elapsedUs - INTRO_IN_US - INTRO_HOLD_US) / INTRO_OUT_US)
    const eased = easeInCubic(progress)
    panelOpacity = lerp(PANEL_MAX_OPACITY, 0, eased)
    titleOpacity = 1 - eased
    translateX = lerp(0, -width * 1.1, eased)
  }

  const panelHeight = Math.max(86, Math.min(168, height * 0.16))
  const panelY = (height - panelHeight) / 2
  const stripeHeight = 10
  const fontSize = Math.max(22, Math.min(48, width * 0.027))

  ctx.save()
  ctx.fillStyle = `rgba(73,84,101,${panelOpacity})`
  ctx.fillRect(0, panelY, width, panelHeight)

  ctx.globalAlpha = panelOpacity
  ctx.fillStyle = '#9ba6b5'
  ctx.fillRect(0, panelY, width, stripeHeight / 2)
  ctx.fillStyle = '#252c36'
  ctx.fillRect(0, panelY + stripeHeight / 2, width, stripeHeight / 2)
  ctx.fillRect(0, panelY + panelHeight - stripeHeight, width, stripeHeight / 2)
  ctx.fillStyle = '#9ba6b5'
  ctx.fillRect(0, panelY + panelHeight - stripeHeight / 2, width, stripeHeight / 2)

  ctx.globalAlpha = titleOpacity
  ctx.font = `800 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = Math.max(3, fontSize * 0.075)
  ctx.strokeStyle = '#05070a'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.95)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  const text = normalizedTitle.length > 72 ? `${normalizedTitle.slice(0, 71)}…` : normalizedTitle
  ctx.strokeText(text, width / 2 + translateX, panelY + panelHeight / 2)
  ctx.fillText(text, width / 2 + translateX, panelY + panelHeight / 2)
  ctx.restore()
}

export interface RecordSceneRenderInput {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  width: number
  height: number
  currentUs: number
  scene: RecordRenderScene
  visuals: RecordRenderVisualOptions
  images?: RecordRenderImages
  activeNotes?: ActiveRenderNote[]
}

function renderRecordSceneLandscape({ ctx, width, height, currentUs, scene, visuals, images, activeNotes }: RecordSceneRenderInput) {
  const keyboardHeight = visuals.showKeyboard ? (width / WHITE_KEY_COUNT) * WHITE_KEY_ASPECT_RATIO : 0
  const rollHeight = Math.max(1, height - keyboardHeight)
  const currentActiveNotes = activeNotes ?? activeNotesAt(currentUs, scene)
  const keySignatureAccidentals = currentKeySignatureAccidentals(currentUs, scene)

  drawSceneBackground(ctx, width, height, visuals, images)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, width, rollHeight)
  ctx.clip()
  renderPianoRoll({
    ctx,
    width,
    height: rollHeight,
    currentUs,
    scene,
    visuals,
    keySignatureAccidentals,
    drawBackground: false,
    drawImpacts: true,
    drawLogo: false,
  })
  ctx.restore()

  if (visuals.showKeyboard) {
    const keyboardLayer = new OffscreenCanvas(width, keyboardHeight)
    const keyboardCtx = keyboardLayer.getContext('2d')
    if (!keyboardCtx) throw new Error('Could not create keyboard layer context.')

    renderPianoKeyboard({
      ctx: keyboardCtx,
      width,
      height: keyboardHeight,
      scene,
      visuals,
      activeNotes: currentActiveNotes,
      keySignatureAccidentals,
      images,
    })

    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.drawImage(keyboardLayer, 0, rollHeight)
    ctx.restore()
  }

  renderPianoRoll({
    ctx,
    width,
    height: rollHeight,
    currentUs,
    scene,
    visuals,
    images,
    keySignatureAccidentals,
    drawBackground: false,
    drawContent: false,
    drawImpacts: false,
    drawLogo: true,
  })

  drawIntroOverlay(ctx, width, height, currentUs, scene.title)
}

function renderRecordScenePortrait({ ctx, width, height, currentUs, scene, visuals, images, activeNotes: inputActiveNotes }: RecordSceneRenderInput) {
  // 1. Full 9:16 frame dark background
  ctx.fillStyle = '#303030'
  ctx.fillRect(0, 0, width, height)

  // 2. Blurred background covering full frame, fit to height
  if (images?.background) {
    ctx.save()
    ctx.filter = 'blur(60px)'
    drawImageCover(ctx, images.background, 0, 0, width, height)
    ctx.restore()
    ctx.fillStyle = `rgba(48,48,48,${visuals.backgroundOpacity + 0.15})`
    ctx.fillRect(0, 0, width, height)
  }

  // 3. 4:3 content area centered vertically
  const contentWidth = width
  const contentHeight = width * 3 / 4
  const contentY = (height - contentHeight) / 2
  const currentActiveNotes = inputActiveNotes ?? activeNotesAt(currentUs, scene)
  const keySignatureAccidentals = currentKeySignatureAccidentals(currentUs, scene)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, contentY, contentWidth, contentHeight)
  ctx.clip()

  // Content area background (non-blurred copy)
  if (images?.background) {
    drawImageCover(ctx, images.background, 0, contentY, contentWidth, contentHeight)
  }
  ctx.fillStyle = `rgba(48,48,48,${visuals.backgroundOpacity})`
  ctx.fillRect(0, contentY, contentWidth, contentHeight)

  // But the piano roll renderAt = 0 (relative to content area), so translate down by contentY
  ctx.translate(0, contentY)

  const keyboardHeight = visuals.showKeyboard ? (contentWidth / WHITE_KEY_COUNT) * WHITE_KEY_ASPECT_RATIO : 0
  const rollHeight = Math.max(1, contentHeight - keyboardHeight)

  // Piano roll within content area
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, contentWidth, rollHeight)
  ctx.clip()
  renderPianoRoll({
    ctx,
    width: contentWidth,
    height: rollHeight,
    currentUs,
    scene,
    visuals,
    keySignatureAccidentals,
    drawBackground: false,
    drawImpacts: true,
    drawLogo: false,
  })
  ctx.restore()

  // Keyboard within content area
  if (visuals.showKeyboard) {
    const keyboardLayer = new OffscreenCanvas(contentWidth, keyboardHeight)
    const keyboardCtx = keyboardLayer.getContext('2d')
    if (!keyboardCtx) throw new Error('Could not create keyboard layer context.')

    renderPianoKeyboard({
      ctx: keyboardCtx,
      width: contentWidth,
      height: keyboardHeight,
      scene,
      visuals,
      activeNotes: currentActiveNotes,
      keySignatureAccidentals,
      images,
    })

    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.drawImage(keyboardLayer, 0, rollHeight)
    ctx.restore()
  }

  // Logo within content area
  renderPianoRoll({
    ctx,
    width: contentWidth,
    height: rollHeight,
    currentUs,
    scene,
    visuals,
    images,
    keySignatureAccidentals,
    drawBackground: false,
    drawContent: false,
    drawImpacts: false,
    drawLogo: true,
  })

  ctx.restore() // pop translate + clip

  // Intro overlay on full frame
  drawIntroOverlay(ctx, width, height, currentUs, scene.title)
}

export function renderRecordScene(input: RecordSceneRenderInput) {
  if (input.visuals.orientation === 'portrait') {
    renderRecordScenePortrait(input)
    return
  }
  renderRecordSceneLandscape(input)
}
