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
const ANDROID_SAFE_RIGHT_PX = 96

function isTauriAndroidApp() {
  return /Android/i.test(navigator.userAgent)
}

function configureAndroidViewport() {
  if (!isTauriAndroidApp()) return

  document.documentElement.classList.add('android-tauri-app')
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (viewport) {
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
  }

  
  const syncViewport = () => {
    const width = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || ANDROID_DESIGN_WIDTH
    const height = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || ANDROID_DESIGN_HEIGHT
    const safeWidth = Math.max(320, width)
    const scale = Math.min(safeWidth / ANDROID_DESIGN_WIDTH, height / ANDROID_DESIGN_HEIGHT)
    const scaledWidth = ANDROID_DESIGN_WIDTH * scale
    const scaledHeight = ANDROID_DESIGN_HEIGHT * scale
    const offsetX = Math.max(0, (width - scaledWidth) / 2)
    const offsetY = Math.max(0, (height - scaledHeight) / 2)

    document.documentElement.style.setProperty('--android-app-scale', String(scale))
    document.documentElement.style.setProperty('--android-app-offset-x', `${offsetX}px`)
    document.documentElement.style.setProperty('--android-app-offset-y', `${offsetY}px`)
  }


  syncViewport()
  window.addEventListener('resize', syncViewport)
  window.addEventListener('orientationchange', syncViewport)
  window.visualViewport?.addEventListener('resize', syncViewport)
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
