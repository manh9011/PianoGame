const DEFAULT_TARGET_WIDTH = 1600
const COMPACT_TARGET_WIDTH = 1920

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

export function syncAppViewport() {
  const { width, height } = viewportSize()
  const scale = shouldScaleViewport(width) ? width / targetWidth : 1
  const layoutHeight = scale < 1 ? height / scale : height

  document.documentElement.style.setProperty('--app-layout-width', `${targetWidth}px`)
  document.documentElement.style.setProperty('--app-viewport-scale', String(scale))
  document.documentElement.style.setProperty('--app-viewport-height', `${layoutHeight}px`)
  document.documentElement.toggleAttribute('data-app-viewport-scaled', scale < 1)
}

export function setAppViewportTarget(compact: boolean) {
  targetWidth = compact ? COMPACT_TARGET_WIDTH : DEFAULT_TARGET_WIDTH
  const meta = document.querySelector('meta[name="viewport"]')
  if (meta) meta.setAttribute('content', `width=${targetWidth}, viewport-fit=cover, user-scalable=no`)
  syncAppViewport()
}
