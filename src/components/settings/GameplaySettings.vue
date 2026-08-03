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
    <label class="row">{{ $t('settings.leadInDuration') }}
      <input type="number" min="0" max="10" step="0.5" :value="settings.leadInDuration" @change="settings.setLeadInDuration(Number(($event.target as HTMLInputElement).value))" />
    </label>
    <label class="row">{{ $t('settings.zoomPercent') }}
      <input type="range" min="50" max="200" step="5" :value="settings.zoomPercent" @input="settings.setZoomPercent(Number(($event.target as HTMLInputElement).value))" />
      <span style="min-width: 3ch; text-align: right">{{ settings.zoomPercent }}%</span>
    </label>
    <label class="row">Octave shift
      <input v-model.number="settings.octaveShift" type="number" min="-4" max="4" step="1" @change="settings.persist" />
    </label>
  </section>
</template>
