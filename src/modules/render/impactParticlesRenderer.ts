import type { Canvas2DContext } from './hitLineRenderer'

export const IMPACT_REWIND_THRESHOLD_US = 80_000
export const IMPACT_REPEAT_THROTTLE_MS = 150
export const IMPACT_REPEAT_THROTTLE_US = IMPACT_REPEAT_THROTTLE_MS * 1000
export const IMPACT_RAY_LIFE_MS = 350
export const IMPACT_RAY_LIFE_US = IMPACT_RAY_LIFE_MS * 1000
export const IMPACT_FLOAT_LIFE_MS = 940
export const IMPACT_FLOAT_LIFE_US = IMPACT_FLOAT_LIFE_MS * 1000
export const MAX_IMPACT_PARTICLES = 160
export const MAX_FLOATING_IMPACT_PARTICLES = 36

const IMPACT_RAY_SPRITE_SIZE = 128
const IMPACT_RAY_GLOW_SPRITE_SIZE = 160
const IMPACT_FLOAT_SPRITE_SIZE = 48
const IMPACT_LIGHT_COLOR = '#ffd166'
const IMPACT_LIGHT_CORE_COLOR = '#fff4bf'
const IMPACT_LIGHT_EDGE_COLOR = '#ffb703'

export const IMPACT_RAY_VARIANTS = [
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

type ImpactRayVariant = typeof IMPACT_RAY_VARIANTS[number]
type SpriteCanvas = HTMLCanvasElement | OffscreenCanvas
type CanvasFactory = (width: number, height: number) => SpriteCanvas
type ImpactSpriteBundle = {
  raySprites: SpriteCanvas[]
  rayGlowSprites: SpriteCanvas[]
  floatSprites: SpriteCanvas[]
}

export type ImpactLayoutNote = {
  id: string
  noteId: number
  trackId: number
  x: number
  width: number
  start?: number
  end?: number
  startUs?: number
  endUs?: number
}

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

function defaultCanvasFactory(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function offscreenCanvasFactory(width: number, height: number) {
  return new OffscreenCanvas(width, height)
}

function get2dContext(canvas: SpriteCanvas) {
  return canvas.getContext('2d') as Canvas2DContext | null
}

function createRaySprite(variant: ImpactRayVariant, createCanvas: CanvasFactory) {
  const canvas = createCanvas(IMPACT_RAY_SPRITE_SIZE, IMPACT_RAY_SPRITE_SIZE)
  const ctx = get2dContext(canvas)
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

function createRayGlowSprite(variant: ImpactRayVariant, createCanvas: CanvasFactory) {
  const canvas = createCanvas(IMPACT_RAY_GLOW_SPRITE_SIZE, IMPACT_RAY_GLOW_SPRITE_SIZE)
  const ctx = get2dContext(canvas)
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

function createFloatSprite(variant: ImpactRayVariant, createCanvas: CanvasFactory) {
  const canvas = createCanvas(IMPACT_FLOAT_SPRITE_SIZE, IMPACT_FLOAT_SPRITE_SIZE)
  const ctx = get2dContext(canvas)
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

function stableRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function noteStartUs(note: ImpactLayoutNote) {
  return note.startUs ?? note.start ?? 0
}

function noteEndUs(note: ImpactLayoutNote) {
  return note.endUs ?? note.end ?? 0
}

function drawImpactRay(
  ctx: Canvas2DContext,
  x: number,
  y: number,
  length: number,
  angle: number,
  variant: ImpactRayVariant,
  coreWidth: number,
  glowWidth: number,
  alpha: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha

  const glow = ctx.createLinearGradient(0, 0, 0, -length)
  glow.addColorStop(0, withAlpha(variant.color, 0.42 * variant.alpha))
  glow.addColorStop(0.32, withAlpha(IMPACT_LIGHT_COLOR, 0.24 * variant.alpha))
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = glow
  ctx.lineWidth = glowWidth
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -length)
  ctx.stroke()

  const core = ctx.createLinearGradient(0, 0, 0, -length)
  core.addColorStop(0, `rgba(255,255,255,${0.94 * variant.alpha})`)
  core.addColorStop(0.38, withAlpha(variant.color, 0.8 * variant.alpha))
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = core
  ctx.lineWidth = coreWidth
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -length)
  ctx.stroke()

  ctx.restore()
}

function drawFloatingImpactParticle(
  ctx: Canvas2DContext,
  x: number,
  y: number,
  radius: number,
  variant: ImpactRayVariant,
  alpha: number,
) {
  const size = radius * 2
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size)
  gradient.addColorStop(0, `rgba(255,255,255,${0.92 * alpha * variant.alpha})`)
  gradient.addColorStop(0.32, withAlpha(variant.color, 0.72 * alpha * variant.alpha))
  gradient.addColorStop(0.72, withAlpha(IMPACT_LIGHT_EDGE_COLOR, 0.22 * alpha * variant.alpha))
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(x - size, y - size, size * 2, size * 2)
}

function drawImpactBurst(ctx: Canvas2DContext, note: ImpactLayoutNote, burstSeed: number, ageUs: number, height: number, yOffset: number, sprites?: ImpactSpriteBundle) {
  const ageRatio = Math.max(0, Math.min(1, ageUs / IMPACT_RAY_LIFE_US))
  const lifeRatio = 1 - ageRatio
  const grow = Math.min(1, ageRatio / 0.32)
  const fade = lifeRatio < 0.42 ? lifeRatio / 0.42 : 1
  if (fade <= 0) return

  const particleCount = Math.max(7, Math.min(16, Math.round(note.width / 4.5)))
  const left = note.x + Math.min(2, note.width * 0.08)
  const usableWidth = Math.max(1, note.width - Math.min(4, note.width * 0.16))
  const minHeight = Math.max(0, note.width * 0.75)
  const maxHeight = Math.max(minHeight + 1, note.width * 0.75 * 1.5)
  const originY = yOffset + height + 4

  for (let index = 0; index < particleCount; index += 1) {
    const ratio = particleCount === 1 ? 0.5 : index / (particleCount - 1)
    const seed = burstSeed + index * 19
    const sideBias = ratio - 0.5
    const spread = sideBias * 0.72 + (stableRandom(seed) - 0.5) * 0.28
    const accent = stableRandom(seed + 3) < 0.14
    const variant = IMPACT_RAY_VARIANTS[Math.floor(stableRandom(seed + 5) * IMPACT_RAY_VARIANTS.length)]
    const targetLength = (minHeight + stableRandom(seed + 7) * (maxHeight - minHeight)) * (accent ? 1.35 + stableRandom(seed + 11) * 0.35 : 1)
    const length = Math.max(1, targetLength * grow)
    const thickness = (0.6 + stableRandom(seed + 13) * 1.15) * (accent ? 1.05 : 1)
    const coreWidth = thickness * (10 + grow * 8)
    const glowWidth = coreWidth * (1.2 + stableRandom(seed + 17) * 1.05) * (1.05 + grow * 0.35)
    const x = left + usableWidth * ratio + (stableRandom(seed + 23) - 0.5) * Math.min(3, note.width * 0.08)
    const y = originY - stableRandom(seed + 29) * 0.6
    if (sprites) {
      const sprite = sprites.raySprites[IMPACT_RAY_VARIANTS.indexOf(variant)]
      const glowSprite = sprites.rayGlowSprites[IMPACT_RAY_VARIANTS.indexOf(variant)]
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(spread)
      ctx.globalAlpha = fade * (0.2 + stableRandom(seed + 31) * 0.22)
      ctx.drawImage(glowSprite, -glowWidth / 2, -length, glowWidth, length)
      ctx.globalAlpha = fade
      ctx.drawImage(sprite, -coreWidth / 2, -length, coreWidth, length)
      ctx.restore()
    } else {
      drawImpactRay(ctx, x, y, length, spread, variant, coreWidth, glowWidth, fade)
    }
  }

  if (stableRandom(burstSeed + 101) >= 0.35) return
  const floatCount = 1 + Math.floor(stableRandom(burstSeed + 103) * 3)
  const floatAgeRatio = Math.max(0, Math.min(1, ageUs / IMPACT_FLOAT_LIFE_US))
  const floatAlpha = Math.sin(floatAgeRatio * Math.PI) * 0.72
  if (floatAlpha <= 0) return

  for (let index = 0; index < floatCount; index += 1) {
    const seed = burstSeed + 211 + index * 37
    const variant = IMPACT_RAY_VARIANTS[Math.floor(stableRandom(seed + 5) * IMPACT_RAY_VARIANTS.length)]
    const startX = left + stableRandom(seed + 7) * usableWidth
    const startY = originY - stableRandom(seed + 11) * 8
    const vx = (stableRandom(seed + 13) - 0.5) * 0.035
    const vy = -0.035 - stableRandom(seed + 17) * 0.055
    const ageMs = ageUs / 1000
    const radius = (4 + stableRandom(seed + 19) * 7) * (0.7 + floatAgeRatio * 0.55)
    if (sprites) {
      const sprite = sprites.floatSprites[IMPACT_RAY_VARIANTS.indexOf(variant)]
      const size = radius * 2
      ctx.globalAlpha = floatAlpha
      ctx.drawImage(sprite, startX + vx * ageMs - size, startY + vy * ageMs - size, size * 2, size * 2)
    } else {
      drawFloatingImpactParticle(ctx, startX + vx * ageMs, startY + vy * ageMs, radius, variant, floatAlpha)
    }
  }
}

export function drawImpactParticlesStateless(
  ctx: Canvas2DContext,
  notes: ImpactLayoutNote[],
  currentUs: number,
  height: number,
  yOffset = 0,
  sprites?: ImpactSpriteBundle,
) {
  const maxBurstAgeUs = Math.max(IMPACT_RAY_LIFE_US, IMPACT_FLOAT_LIFE_US)
  const impactedNotes = notes.filter(note => currentUs >= noteStartUs(note) && currentUs <= noteEndUs(note) + maxBurstAgeUs)
  if (!impactedNotes.length) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (const note of impactedNotes) {
    const startUs = noteStartUs(note)
    const endUs = noteEndUs(note)
    const lastPlayableUs = Math.min(currentUs, endUs)
    if (lastPlayableUs < startUs) continue
    const baseSeed = Number(note.id.replace(/\D/g, '').slice(-6)) || note.noteId * 97 + note.trackId * 31
    const lastBurstIndex = Math.floor((lastPlayableUs - startUs) / IMPACT_REPEAT_THROTTLE_US)
    const firstBurstIndex = Math.max(0, Math.floor((currentUs - startUs - maxBurstAgeUs) / IMPACT_REPEAT_THROTTLE_US))

    for (let burstIndex = firstBurstIndex; burstIndex <= lastBurstIndex; burstIndex += 1) {
      const burstUs = startUs + burstIndex * IMPACT_REPEAT_THROTTLE_US
      const ageUs = currentUs - burstUs
      if (ageUs < 0 || ageUs > maxBurstAgeUs) continue
      drawImpactBurst(ctx, note, baseSeed + burstIndex * 1009, ageUs, height, yOffset, sprites)
    }
  }

  ctx.restore()
}

function createImpactSprites(createCanvas: CanvasFactory): ImpactSpriteBundle {
  return {
    raySprites: IMPACT_RAY_VARIANTS.map(variant => createRaySprite(variant, createCanvas)),
    rayGlowSprites: IMPACT_RAY_VARIANTS.map(variant => createRayGlowSprite(variant, createCanvas)),
    floatSprites: IMPACT_RAY_VARIANTS.map(variant => createFloatSprite(variant, createCanvas)),
  }
}

let offscreenImpactSprites: ImpactSpriteBundle | null | undefined

function getOffscreenImpactSprites() {
  if (offscreenImpactSprites !== undefined) return offscreenImpactSprites
  if (typeof OffscreenCanvas === 'undefined') {
    offscreenImpactSprites = null
    return offscreenImpactSprites
  }

  try {
    offscreenImpactSprites = createImpactSprites(offscreenCanvasFactory)
  } catch {
    offscreenImpactSprites = null
  }
  return offscreenImpactSprites
}

export function drawImpactParticlesStatelessWithSprites(
  ctx: Canvas2DContext,
  notes: ImpactLayoutNote[],
  currentUs: number,
  height: number,
  yOffset = 0,
) {
  drawImpactParticlesStateless(ctx, notes, currentUs, height, yOffset, getOffscreenImpactSprites() ?? undefined)
}

export function createImpactParticleRenderer(createCanvas: CanvasFactory = defaultCanvasFactory, random: () => number = Math.random) {
  const particles: ImpactParticle[] = []
  const floatingParticles: FloatingImpactParticle[] = []
  const { raySprites, rayGlowSprites, floatSprites } = createImpactSprites(createCanvas)

  function clear() {
    particles.length = 0
    floatingParticles.length = 0
  }

  function liveCount() {
    return particles.length + floatingParticles.length
  }

  function floatingCount() {
    return floatingParticles.length
  }

  function spawn(note: ImpactLayoutNote, logicalHeight: number) {
    const y = logicalHeight + 4
    const particleCount = Math.max(7, Math.min(16, Math.round(note.width / 4.5)))
    const left = note.x + Math.min(2, note.width * 0.08)
    const usableWidth = Math.max(1, note.width - Math.min(4, note.width * 0.16))
    const minHeight = Math.max(0, note.width * 0.75)
    const maxHeight = Math.max(minHeight + 1, note.width * 0.75 * 1.5)

    for (let i = 0; i < particleCount; i += 1) {
      const ratio = particleCount === 1 ? 0.5 : i / (particleCount - 1)
      const sideBias = ratio - 0.5
      const spread = sideBias * 0.72 + (random() - 0.5) * 0.28
      const angle = -Math.PI / 2 + spread
      const accent = random() < 0.14
      particles.push({
        x: left + usableWidth * ratio + (random() - 0.5) * Math.min(3, note.width * 0.08),
        y: y - random() * 0.6,
        angle,
        startLength: random() * minHeight,
        endLength: (minHeight + random() * (maxHeight - minHeight)) * (accent ? 1.35 + random() * 0.35 : 1),
        thickness: (0.6 + random() * 1.15) * (accent ? 1.05 : 1),
        life: 190 + random() * 160,
        maxLife: IMPACT_RAY_LIFE_MS,
        colorIndex: Math.floor(random() * IMPACT_RAY_VARIANTS.length),
        glowWidth: 1.2 + random() * 1.05,
        glowAlpha: 0.2 + random() * 0.22,
      })
    }
    if (random() < 0.35) {
      const floatCount = 1 + Math.floor(random() * 3)
      for (let i = 0; i < floatCount; i += 1) {
        floatingParticles.push({
          x: left + random() * usableWidth,
          y: y - random() * 8,
          vx: (random() - 0.5) * 0.035,
          vy: -0.035 - random() * 0.055,
          radius: 4 + random() * 7,
          life: 520 + random() * 420,
          maxLife: IMPACT_FLOAT_LIFE_MS,
          colorIndex: Math.floor(random() * IMPACT_RAY_VARIANTS.length),
        })
      }
    }

    while (particles.length > MAX_IMPACT_PARTICLES) particles.shift()
    while (floatingParticles.length > MAX_FLOATING_IMPACT_PARTICLES) floatingParticles.shift()
  }

  function update(dt: number) {
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

  function draw(ctx: CanvasRenderingContext2D) {
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

  return { clear, liveCount, floatingCount, spawn, update, draw }
}
