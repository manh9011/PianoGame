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
const ANDROID_DESIGN_WIDTH = 1920
const ANDROID_DESIGN_HEIGHT = 1080

function isTauriAndroidApp() {
  const tauriWindow = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }
  const isAndroid = /Android/i.test(navigator.userAgent)
  const isTauri = Boolean(tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__) || location.protocol === 'tauri:' || location.hostname === 'tauri.localhost'
  return isAndroid && isTauri
}

function configureAndroidViewport() {
  if (!isTauriAndroidApp()) return

  document.documentElement.classList.add('android-tauri-app')
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!viewport) return

  const syncViewport = () => {
    const screenWidth = window.screen.width || 0
    const screenHeight = window.screen.height || 0
    const landscapeWidth = Math.max(screenWidth, screenHeight, window.innerWidth || 0)
    const landscapeHeight = Math.min(screenWidth || window.innerHeight || 0, screenHeight || window.innerHeight || 0)
    const scale = Math.min(1, Math.max(0.1, Math.min(landscapeWidth / ANDROID_DESIGN_WIDTH, landscapeHeight / ANDROID_DESIGN_HEIGHT)))
    viewport.content = `width=${ANDROID_DESIGN_WIDTH}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no, viewport-fit=cover`
  }

  syncViewport()
  window.addEventListener('resize', syncViewport)
  window.addEventListener('orientationchange', syncViewport)
}

configureAndroidViewport()

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
