const DEFAULT_TARGET_WIDTH = 1600
const COMPACT_TARGET_WIDTH = 1920

let targetWidth = DEFAULT_TARGET_WIDTH

function viewportSize() {
  const visualHeight = window.visualViewport?.height ?? 0
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: document.fullscreenElement ? Math.max(window.innerHeight, visualHeight) : (visualHeight || window.innerHeight),
  }
}

function shouldScaleViewport(width: number) {
  return width > 0 && width < targetWidth && (navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches)
}

function isTouchFullscreen() {
  if (!(navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches)) return false
  return Boolean(document.fullscreenElement)
}

function fullscreenTopInset() {
  if (!isTouchFullscreen()) return 0
  return Math.max(0, window.visualViewport?.offsetTop ?? 0)
}

export function syncAppViewport() {
  const { width, height } = viewportSize()
  const scale = shouldScaleViewport(width) ? width / targetWidth : 1
  const topInset = fullscreenTopInset()
  const availableHeight = Math.max(1, height - topInset)
  const layoutHeight = scale < 1 ? availableHeight / scale : availableHeight

  document.documentElement.style.setProperty('--app-layout-width', `${targetWidth}px`)
  document.documentElement.style.setProperty('--app-viewport-scale', String(scale))
  document.documentElement.style.setProperty('--app-viewport-top', `${topInset}px`)
  document.documentElement.style.setProperty('--app-viewport-height', `${layoutHeight}px`)
  document.documentElement.toggleAttribute('data-app-viewport-offset', topInset > 0 || scale < 1)
  document.documentElement.toggleAttribute('data-app-viewport-scaled', scale < 1)
}

export function setAppViewportTarget(compact: boolean) {
  targetWidth = compact ? COMPACT_TARGET_WIDTH : DEFAULT_TARGET_WIDTH
  const meta = document.querySelector('meta[name="viewport"]')
  if (meta) meta.setAttribute('content', `width=${targetWidth}, viewport-fit=cover, user-scalable=no`)
  syncAppViewport()
}
