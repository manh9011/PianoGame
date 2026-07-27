export type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export const ROLL_HIT_LINE_HEIGHT = 6
export const KEYBOARD_HIT_LINE_HEIGHT = 4
export const KEYBOARD_HIT_LINE_TOP_OVERHANG = 4

export function keyboardWhiteKeyTopOffset() {
  return KEYBOARD_HIT_LINE_HEIGHT + KEYBOARD_HIT_LINE_TOP_OVERHANG
}

export function drawRollHitLine(ctx: Canvas2DContext, width: number, height: number, isStopped: boolean) {
  const y = height - ROLL_HIT_LINE_HEIGHT
  const gradient = ctx.createLinearGradient(0, y, 0, y + ROLL_HIT_LINE_HEIGHT)
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
  ctx.fillRect(0, y, width, ROLL_HIT_LINE_HEIGHT)
}

export function drawKeyboardHitLine(ctx: Canvas2DContext, width: number) {
  ctx.fillStyle = '#e01b24'
  ctx.fillRect(0, 0, width, KEYBOARD_HIT_LINE_HEIGHT)
}
