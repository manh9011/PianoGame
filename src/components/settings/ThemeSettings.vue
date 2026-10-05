<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore'
const settings = useSettingsStore()
onMounted(() => { document.documentElement.dataset.theme = settings.theme })
</script>

<template>
  <section class="panel grid">
    <h2>Theme</h2>
    <div class="row">
      <button :class="{ secondary: settings.theme !== 'dark' }" @click="settings.setTheme('dark')">Dark</button>
      <button :class="{ secondary: settings.theme !== 'light' }" @click="settings.setTheme('light')">Light</button>
    </div>
  </section>
</template>
