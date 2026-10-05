import { defineStore } from 'pinia'

export type ToastType = 'loading' | 'success' | 'error' | 'info'

export interface ToastState {
  visible: boolean
  message: string
  type: ToastType
  progress: number
}

export const useToastStore = defineStore('toast', {
  state: (): ToastState => ({
    visible: false,
    message: '',
    type: 'info',
    progress: 0,
  }),
  actions: {
    show(message: string, type: ToastType = 'info') {
      this.message = message
      this.type = type
      this.progress = 0
      this.visible = true
    },
    showLoading(message: string) {
      this.show(message, 'loading')
    },
    updateProgress(progress: number) {
      this.progress = Math.max(0, Math.min(100, progress))
    },
    showSuccess(message: string, autoDismiss = true) {
      this.message = message
      this.type = 'success'
      this.progress = 100
      this.visible = true
      if (autoDismiss) {
        setTimeout(() => this.hide(), 3000)
      }
    },
    showError(message: string, autoDismiss = true) {
      this.message = message
      this.type = 'error'
      this.progress = 0
      this.visible = true
      if (autoDismiss) {
        setTimeout(() => this.hide(), 5000)
      }
    },
    hide() {
      this.visible = false
    },
  },
})
