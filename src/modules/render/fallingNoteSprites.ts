import type { Canvas2DContext } from './hitLineRenderer'

export interface FallingNoteSpriteOptions {
  color: string
  blackKey?: boolean
  outline?: boolean
  softBevel?: boolean
  /** Device pixels per CSS pixel; masters are painted at this scale so blits stay crisp. */
  scale?: number
}

const PAD = 8
const RADIUS_WHITE = 5
const RADIUS_BLACK = 4
// ponytail: nine-part master is assembled once per key width, then drawn as three
// vertical slices when note height varies; upgrade only if widths vary each frame.
const MASTER_W = 48
const MASTER_H = 64
const SHORT_H = 24
const CORNER = 8

function spriteKey(options: FallingNoteSpriteOptions, rw: number, tall: boolean, scale: number) {
  return `${options.color}|${options.blackKey ? 'b' : 'w'}|${options.outline ? 'o' : 'n'}|${options.softBevel ? 's' : 'f'}|${rw}|${tall ? 't' : 's'}|${scale}`
}

function stableSpriteKey(options: FallingNoteSpriteOptions, rw: number, rh: number, scale: number) {
  return `${options.color}|${options.blackKey ? 'b' : 'w'}|${options.outline ? 'o' : 'n'}|${options.softBevel ? 's' : 'f'}|${rw}x${rh}|${scale}`
}

function roundedRectPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function paintMaster(options: FallingNoteSpriteOptions, rw: number, mh: number, scale: number): HTMLCanvasElement | OffscreenCanvas {
  const s = scale
  const RW = Math.max(1, Math.round(rw * s))
  const MH = Math.max(1, Math.round(mh * s))
  const pad = Math.ceil(PAD * s)
  const radius = (options.blackKey ? RADIUS_BLACK : RADIUS_WHITE) * s
  const cw = RW + pad * 2
  const ch = MH + pad * 2
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(cw, ch)
    : (() => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c })()
  const ctx = canvas.getContext('2d') as Canvas2DContext | null
  if (!ctx) return canvas
  const x = pad
  const y = pad

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.36)'
  ctx.shadowBlur = 3.2 * s
  ctx.shadowOffsetX = 2.5 * s
  ctx.shadowOffsetY = 3 * s
  roundedRectPath(ctx, x, y, RW, MH, radius)
  ctx.fillStyle = options.color
  ctx.fill()
  ctx.restore()

  const bevel = ctx.createLinearGradient(x, y, options.softBevel ? x : x + RW, y + MH)
  if (options.softBevel) {
    bevel.addColorStop(0, 'rgba(255,255,255,0.35)')
    bevel.addColorStop(0.32, 'rgba(255,255,255,0.08)')
    bevel.addColorStop(1, 'rgba(0,0,0,0.18)')
  } else {
    bevel.addColorStop(0, 'rgba(255,255,255,0.48)')
    bevel.addColorStop(0.22, 'rgba(255,255,255,0.14)')
    bevel.addColorStop(0.58, 'rgba(0,0,0,0)')
    bevel.addColorStop(1, 'rgba(0,0,0,0.28)')
  }
  roundedRectPath(ctx, x + s, y + s, Math.max(0, RW - s * 2), Math.max(0, MH - s * 2), Math.max(0, radius - s))
  ctx.fillStyle = bevel
  ctx.fill()

  if (!options.softBevel) {
    roundedRectPath(ctx, x + s, y + s, Math.max(0, RW - s * 2), Math.max(1, 1.5 * s), s)
    ctx.fillStyle = 'rgba(255,255,255,0.52)'
    ctx.fill()
  }

  if (options.outline) {
    ctx.lineWidth = Math.max(1, s)
    ctx.strokeStyle = 'rgba(0,0,0,0.32)'
    roundedRectPath(ctx, x, y, RW, MH, radius)
    ctx.stroke()
  }
  return canvas
}

export function paintFallingNoteDirect(ctx: Canvas2DContext, options: FallingNoteSpriteOptions, x: number, y: number, w: number, h: number) {
  const radius = options.blackKey ? RADIUS_BLACK : RADIUS_WHITE
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.36)'
  ctx.shadowBlur = 3.2
  ctx.shadowOffsetX = 2.5
  ctx.shadowOffsetY = 3
  roundedRectPath(ctx, x, y, w, h, radius)
  ctx.fillStyle = options.color
  ctx.fill()
  ctx.restore()

  const bevel = ctx.createLinearGradient(x, y, options.softBevel ? x : x + w, y + h)
  if (options.softBevel) {
    bevel.addColorStop(0, 'rgba(255,255,255,0.35)')
    bevel.addColorStop(0.32, 'rgba(255,255,255,0.08)')
    bevel.addColorStop(1, 'rgba(0,0,0,0.18)')
  } else {
    bevel.addColorStop(0, 'rgba(255,255,255,0.48)')
    bevel.addColorStop(0.22, 'rgba(255,255,255,0.14)')
    bevel.addColorStop(0.58, 'rgba(0,0,0,0)')
    bevel.addColorStop(1, 'rgba(0,0,0,0.28)')
  }
  roundedRectPath(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), Math.max(0, radius - 1))
  ctx.fillStyle = bevel
  ctx.fill()

  if (!options.softBevel) {
    roundedRectPath(ctx, x + 1, y + 1, Math.max(0, w - 2), 1.5, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.52)'
    ctx.fill()
  }

  if (options.outline) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0,0,0,0.32)'
    roundedRectPath(ctx, x, y, w, h, radius)
    ctx.stroke()
  }
}

const spriteCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>()

function getMasterSprite(options: FallingNoteSpriteOptions, rw: number, tall: boolean, scale: number) {
  const key = spriteKey(options, rw, tall, scale)
  const cached = spriteCache.get(key)
  if (cached) return cached
  const baseKey = spriteKey(options, MASTER_W, tall, scale)
  let base = spriteCache.get(baseKey)
  if (!base) {
    base = paintMaster(options, MASTER_W, tall ? MASTER_H : SHORT_H, scale)
    if (spriteCache.size > 256) spriteCache.clear()
    spriteCache.set(baseKey, base)
  }
  if (rw === MASTER_W) return base
  const pad = Math.ceil(PAD * scale)
  const width = Math.max(1, Math.round(rw * scale)) + 2 * pad
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, base.height)
    : (() => { const c = document.createElement('canvas'); c.width = width; c.height = base.height; return c })()
  const ctx = canvas.getContext('2d') as Canvas2DContext | null
  if (ctx) {
    const sourceCap = pad + (options.blackKey ? RADIUS_BLACK : RADIUS_WHITE) * scale
    const verticalCap = pad + CORNER * scale
    const targetCap = Math.min(sourceCap, width / 2)
    const rows = [0, verticalCap, base.height - verticalCap, base.height]
    const columns = [0, sourceCap, base.width - sourceCap, base.width]
    const targetColumns = [0, targetCap, width - targetCap, width]
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const segmentWidth = targetColumns[column + 1] - targetColumns[column]
        if (segmentWidth <= 0) continue
        ctx.drawImage(base, columns[column], rows[row], columns[column + 1] - columns[column], rows[row + 1] - rows[row], targetColumns[column], rows[row], segmentWidth, rows[row + 1] - rows[row])
      }
    }
  }
  if (spriteCache.size > 256) spriteCache.clear()
  spriteCache.set(key, canvas)
  return canvas
}

// Stable full-size sprites for realtime views: falling notes keep fixed w/h while only
// x/y move (only notes crossing the hit line resize), so a baked exact-size sprite gives
// one 1:1 blit per note with corners pixel-identical to direct paint. Notes whose size
// changed since last frame use the direct-paint fallback, so the cache never thrashes.
const stableSpriteCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>()
const lastSizeById = new Map<string, string>()

function padCss(scale: number) {
  return Math.ceil(PAD * scale) / scale
}

export function drawStableFallingNoteSprite(
  ctx: Canvas2DContext,
  options: FallingNoteSpriteOptions,
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: () => void,
) {
  const scale = options.scale && options.scale > 0 ? options.scale : 1
  const scaleQ = Math.round(scale * 100) / 100
  const rw = Math.max(1, Math.round(w))
  const rh = Math.max(1, Math.round(h))
  const key = stableSpriteKey(options, rw, rh, scaleQ)
  if (lastSizeById.get(id) !== key) {
    lastSizeById.set(id, key)
    if (lastSizeById.size > 4096) {
      const oldest = lastSizeById.keys().next().value
      if (oldest !== undefined) lastSizeById.delete(oldest)
    }
    fallback()
    return
  }
  let sprite = stableSpriteCache.get(key)
  if (!sprite) {
    sprite = paintMaster(options, rw, rh, scale)
    if (stableSpriteCache.size > 512) stableSpriteCache.clear()
    stableSpriteCache.set(key, sprite)
  }
  const p = padCss(scale)
  ctx.drawImage(sprite, Math.round(x) - p, Math.round(y) - p, rw + p * 2, rh + p * 2)
}

// 3-slice vertical for offline export: top cap + stretched middle + bottom cap.
// Width 1:1, corners intact.
export function drawFallingNoteSprite(
  ctx: Canvas2DContext,
  options: FallingNoteSpriteOptions,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = options.scale && options.scale > 0 ? options.scale : 1
  const rw = Math.max(1, Math.round(w))
  const rh = Math.max(1, Math.round(h))
  const tall = rh >= CORNER * 2 + 4
  const sprite = getMasterSprite(options, rw, tall, Math.round(scale * 100) / 100)
  const sw = sprite.width
  const c = CORNER * scale + Math.ceil(PAD * scale)
  const dx = Math.round(x) - Math.ceil(PAD * scale) / scale
  const dy = Math.round(y) - Math.ceil(PAD * scale) / scale
  const dw = rw + (Math.ceil(PAD * scale) / scale) * 2
  const dh = rh + (Math.ceil(PAD * scale) / scale) * 2
  // ponytail: note shorter than both caps — single scaled blit, avoids crushed 3-slice math.
  if (dh < (c / scale) * 2 + 1) {
    ctx.drawImage(sprite, dx, dy, dw, dh)
    return
  }
  const srcMidH = Math.max(1, sprite.height - c * 2)
  const midH = Math.max(1, dh - (c / scale) * 2)
  const capH = c / scale
  ctx.drawImage(sprite, 0, 0, sw, c, dx, dy, dw, capH)
  ctx.drawImage(sprite, 0, c, sw, srcMidH, dx, dy + capH, dw, midH)
  ctx.drawImage(sprite, 0, c + srcMidH, sw, c, dx, dy + capH + midH, dw, capH)
}
