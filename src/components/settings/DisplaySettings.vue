<script setup lang="ts">
import { useSettingsStore } from '../../stores/settingsStore'
const settings = useSettingsStore()

function onKeyLabelsChange(event: Event) {
  settings.setShowKeyLabels((event.target as HTMLInputElement).checked)
}

function onNoteLabelsChange(event: Event) {
  settings.setShowNoteLabels((event.target as HTMLInputElement).checked)
}
</script>

<template>
  <section class="panel grid">
    <h2>Display</h2>
    <label><input :checked="settings.showKeyLabels" type="checkbox" @change="onKeyLabelsChange" /> Hiển thị nhãn phím</label>
    <label><input :checked="settings.showNoteLabels" type="checkbox" @change="onNoteLabelsChange" /> Hiển thị nhãn note rơi</label>
    <label><input v-model="settings.showGrid" type="checkbox" @change="settings.persist" /> Hiển thị grid</label>
  </section>
</template>
