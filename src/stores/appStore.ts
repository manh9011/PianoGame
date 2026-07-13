import { defineStore } from 'pinia'
export const useAppStore = defineStore('app', { state: () => ({ closeMessage: '' }), actions: { exitApp() { window.close(); this.closeMessage = 'Trình duyệt không cho phép đóng tab tự động. Bạn có thể đóng tab thủ công.' } } })
