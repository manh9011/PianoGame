<script setup lang="ts">
import { useSettingsStore } from '../../stores/settingsStore'
const settings = useSettingsStore()
</script>

<template>
  <section class="panel grid">
    <h2>Gameplay</h2>
    <label class="row">Default speed
      <input type="number" min="0" max="400" step="10" :value="settings.defaultSpeed" @change="settings.setSpeed(Number(($event.target as HTMLInputElement).value))" />
    </label>
    <label class="row">Show duration
      <input type="number" min="0.25" max="10" step="0.25" :value="settings.showDuration" @change="settings.setShowDuration(Number(($event.target as HTMLInputElement).value))" />
    </label>
    <label class="row">Octave shift
      <input v-model.number="settings.octaveShift" type="number" min="-4" max="4" step="1" @change="settings.persist" />
    </label>
  </section>
</template>
