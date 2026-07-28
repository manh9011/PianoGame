import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { useLibraryStore } from './stores/libraryStore'
import { useSettingsStore } from './stores/settingsStore'
import { useProfileStore } from './stores/profileStore'
import { useFreePlayStore } from './stores/freePlayStore'
import { i18n } from './i18n'
import { useToastStore } from './stores/toastStore'

const t = i18n.global.t as (key: string, named?: Record<string, unknown>) => string
const IOS_DESIGN_WIDTH = 1920
const IOS_DESIGN_HEIGHT = 1080

function isIosDevice() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function configureIosSafeViewport() {
  if (!isIosDevice()) return

  document.documentElement.classList.add('ios-safe-area-app')
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (viewport) {
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
  }

  const safeAreaProbe = document.createElement('div')
  safeAreaProbe.style.cssText = [
    'position:fixed',
    'inset:0',
    'visibility:hidden',
    'pointer-events:none',
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
  ].join(';')
  document.body.appendChild(safeAreaProbe)

  const readInsets = () => {
    const style = getComputedStyle(safeAreaProbe)
    return {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0
    }
  }

  const syncViewport = () => {
    const viewportWidth = window.visualViewport?.width || window.innerWidth || IOS_DESIGN_WIDTH
    const viewportHeight = window.visualViewport?.height || window.innerHeight || IOS_DESIGN_HEIGHT
    const insets = readInsets()
    const safeWidth = Math.max(1, viewportWidth - insets.left - insets.right)
    const safeHeight = Math.max(1, viewportHeight - insets.top - insets.bottom)
    const scale = Math.max(0.1, Math.min(safeWidth / IOS_DESIGN_WIDTH, safeHeight / IOS_DESIGN_HEIGHT))
    const scaledWidth = IOS_DESIGN_WIDTH * scale
    const scaledHeight = IOS_DESIGN_HEIGHT * scale
    const offsetX = insets.left + Math.max(0, (safeWidth - scaledWidth) / 2)
    const offsetY = insets.top + Math.max(0, (safeHeight - scaledHeight) / 2)

    document.documentElement.style.setProperty('--ios-app-scale', String(scale))
    document.documentElement.style.setProperty('--ios-app-offset-x', `${offsetX}px`)
    document.documentElement.style.setProperty('--ios-app-offset-y', `${offsetY}px`)
  }

  const scheduleSync = () => {
    syncViewport()
    requestAnimationFrame(syncViewport)
    window.setTimeout(syncViewport, 80)
    window.setTimeout(syncViewport, 300)
  }

  scheduleSync()
  window.addEventListener('resize', scheduleSync)
  window.addEventListener('orientationchange', scheduleSync)
  window.addEventListener('pageshow', scheduleSync)
  window.addEventListener('load', scheduleSync)
  window.visualViewport?.addEventListener('resize', scheduleSync)
  window.visualViewport?.addEventListener('scroll', scheduleSync)
}

configureIosSafeViewport()

async function initApp() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)

  const toastStore = useToastStore()
  const libraryStore = useLibraryStore()
  const settingsStore = useSettingsStore()
  const profileStore = useProfileStore()
  const freePlayStore = useFreePlayStore()

  toastStore.showLoading(t('common.loadingData'))

  let completed = 0
  const total = 4

  await Promise.all([
    libraryStore.hydrate().then(() => {
      completed++
      toastStore.updateProgress((completed / total) * 100)
    }),
    settingsStore.hydrate().then(() => {
      completed++
      toastStore.updateProgress((completed / total) * 100)
    }),
    profileStore.hydrate().then(() => {
      completed++
      toastStore.updateProgress((completed / total) * 100)
    }),
    freePlayStore.hydrate().then(() => {
      completed++
      toastStore.updateProgress((completed / total) * 100)
    })
  ])

  toastStore.showSuccess(t('common.loaded'))

  app.use(router).mount('#app')
}

initApp()
