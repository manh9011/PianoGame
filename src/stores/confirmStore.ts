import { defineStore } from 'pinia'

export type ConfirmDialogTone = 'primary' | 'danger'

export interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
}

export interface ConfirmDialogState {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  tone: ConfirmDialogTone
}

let activeResolve: ((confirmed: boolean) => void) | null = null

export const useConfirmStore = defineStore('confirm', {
  state: (): ConfirmDialogState => ({
    visible: false,
    title: '',
    message: '',
    confirmLabel: '',
    cancelLabel: '',
    tone: 'danger',
  }),
  actions: {
    open(options: ConfirmDialogOptions) {
      if (activeResolve) activeResolve(false)

      this.title = options.title ?? ''
      this.message = options.message
      this.confirmLabel = options.confirmLabel ?? ''
      this.cancelLabel = options.cancelLabel ?? ''
      this.tone = options.tone ?? 'danger'
      this.visible = true

      return new Promise<boolean>(resolve => {
        activeResolve = resolve
      })
    },
    confirm() {
      this.settle(true)
    },
    cancel() {
      this.settle(false)
    },
    settle(confirmed: boolean) {
      if (!this.visible && !activeResolve) return

      this.visible = false
      const resolve = activeResolve
      activeResolve = null
      resolve?.(confirmed)
    },
  },
})
