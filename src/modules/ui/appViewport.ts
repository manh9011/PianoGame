const DEFAULT_TARGET_WIDTH = 1600
const COMPACT_TARGET_WIDTH = 1920
const FALLBACK_FULLSCREEN_TOP_INSET = 36

let targetWidth = DEFAULT_TARGET_WIDTH

function viewportSize() {
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  }
}

function shouldScaleViewport(width: number) {
  return width > 0 && width < targetWidth && (navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches)
}

function isTouchFullscreen() {
  if (!(navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches)) return false
  return Boolean(document.fullscreenElement) ||
    (Math.abs(window.innerWidth - screen.width) <= 1 && Math.abs(window.innerHeight - screen.height) <= 1)
}

function fullscreenTopInset() {
  if (!isTouchFullscreen()) return 0
  const viewportOffset = Math.max(0, window.visualViewport?.offsetTop ?? 0)
  if (viewportOffset > 0) return viewportOffset

  const screenInset = Math.max(0, window.screen.height - window.screen.availHeight)
  if (screenInset > 0 && screenInset < 96) return screenInset

  return FALLBACK_FULLSCREEN_TOP_INSET
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
