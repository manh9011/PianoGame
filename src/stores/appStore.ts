import { invoke, isTauri } from '@tauri-apps/api/core'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    isTauriApp: isTauri(),
  }),
  actions: {
    async exitApp() {
      if (!this.isTauriApp) return
      await invoke('exit_app')
    },
  },
})
