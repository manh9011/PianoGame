<script setup lang="ts">
import Toast from './components/Toast.vue'
import ConfirmDialog from './components/player/dialogs/ConfirmDialog.vue'
import { RouterView } from 'vue-router'
import { Analytics } from "@vercel/analytics/vue"
import { useShortcuts } from './composables/useShortcuts'

useShortcuts({
  toggleFullScreen: () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }
})
</script>

<template>
  <Analytics />
  <Toast />
  <ConfirmDialog />
  <RouterView />
</template>
