<script setup lang="ts">
import Toast from './components/Toast.vue'
import ConfirmDialog from './components/player/dialogs/ConfirmDialog.vue'
import { RouterView } from 'vue-router'
import { Analytics } from "@vercel/analytics/vue"
import { useShortcuts } from './composables/useShortcuts'
import { isElectron } from './modules/desktopBridge'

function fullscreenAllowed() {
  return !(navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches)
}

useShortcuts({
  toggleFullScreen: () => {
    if (!fullscreenAllowed()) return
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }
})
</script>

<template>
  <Analytics v-if="!isElectron()" />
  <Toast />
  <ConfirmDialog />
  <RouterView />
</template>
