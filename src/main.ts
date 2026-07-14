import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/base.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { useLibraryStore } from './stores/libraryStore'
import { useSettingsStore } from './stores/settingsStore'
import { useProfileStore } from './stores/profileStore'
import { i18n } from './i18n'
import { useToastStore } from './stores/toastStore'

const t = i18n.global.t as (key: string, named?: Record<string, unknown>) => string

async function initApp() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)

  const toastStore = useToastStore()
  const libraryStore = useLibraryStore()
  const settingsStore = useSettingsStore()
  const profileStore = useProfileStore()

  toastStore.showLoading(t('common.loadingData'))

  let completed = 0
  const total = 3

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
    })
  ])

  toastStore.showSuccess(t('common.loaded'))

  app.use(router).mount('#app')
}

initApp()
