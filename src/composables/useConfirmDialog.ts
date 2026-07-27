import { useConfirmStore, type ConfirmDialogOptions } from '../stores/confirmStore'

export function useConfirmDialog() {
  const confirmStore = useConfirmStore()

  return {
    confirm: (options: ConfirmDialogOptions) => confirmStore.open(options),
  }
}
