import { invoke, isTauri } from '@tauri-apps/api/core'
import { defineStore } from 'pinia'
import { exitApp as exitElectronApp, isElectron } from '../modules/desktopBridge'

export const useAppStore = defineStore('app', {
  state: () => ({
    isTauriApp: isTauri() || isElectron(),
  }),
  actions: {
    async exitApp() {
      if (isElectron()) {
        exitElectronApp()
        return
      }
      if (!isTauri()) return
      await invoke('exit_app')
    },
  },
})
