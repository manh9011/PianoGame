<script setup lang="ts">
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import type { LabelMode } from '../../types/settings'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()

const labelModes: Array<{ value: LabelMode; label: string }> = [
  { value: 'octaves', label: 'Octaves' },
  { value: 'finger-hint', label: 'Finger hints' },
  { value: 'virtual-piano', label: 'Virtual piano' },
  { value: 'english', label: 'English' },
  { value: 'fixed-do', label: 'Fixed Do' },
  { value: 'movable-do', label: 'Movable Do' },
  { value: 'scale-number', label: 'Scale number' },
  { value: 'simple', label: 'Simple' },
]
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>Color Theme</h2>
        <p>Chọn màu giao diện và cách hiển thị nhãn nốt/phím.</p>
      </div>
    </header>

    <SettingsSection title="Theme Preview">
      <div class="theme-previews">
        <button class="theme-card dark" :class="{ active: settings.theme === 'dark' }" type="button" @click="settings.setTheme('dark')">
          <span class="theme-bar">Color Theme</span>
          <strong>Synthesia Classic</strong>
          <span class="theme-row">labore et dolore <i class="fa-solid fa-chevron-right" /></span>
        </button>
        <button class="theme-card light" :class="{ active: settings.theme === 'light' }" type="button" @click="settings.setTheme('light')">
          <span class="theme-bar">Color Theme</span>
          <strong>Crystal Light</strong>
          <span class="theme-row">labore et dolore <i class="fa-solid fa-chevron-right" /></span>
        </button>
      </div>
    </SettingsSection>

    <SettingsSection title="Labels">
      <SettingsRow title="Key labels" description="Hiển thị nhãn trên phím đàn.">
        <SettingsToggle :model-value="settings.showKeyLabels" @change="settings.setShowKeyLabels($event)" />
      </SettingsRow>
      <SettingsRow title="Key label mode" description="Kiểu nhãn cho bàn phím.">
        <select class="settings-control" :value="settings.keyLabelMode" @change="settings.setKeyLabelMode(($event.target as HTMLSelectElement).value as LabelMode)">
          <option v-for="mode in labelModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
        </select>
      </SettingsRow>
      <SettingsRow title="Key label size" description="Tăng/giảm kích thước nhãn phím.">
        <input class="settings-control compact" type="number" min="-10" max="25" step="1" :value="settings.keyLabelSize" @change="settings.setKeyLabelSize(Number(($event.target as HTMLInputElement).value))" />
      </SettingsRow>
      <SettingsRow title="Falling note labels" description="Hiển thị nhãn trên note rơi.">
        <SettingsToggle :model-value="settings.showNoteLabels" @change="settings.setShowNoteLabels($event)" />
      </SettingsRow>
      <SettingsRow title="Note label mode" description="Kiểu nhãn cho note rơi.">
        <select class="settings-control" :value="settings.noteLabelMode" @change="settings.setNoteLabelMode(($event.target as HTMLSelectElement).value as LabelMode)">
          <option v-for="mode in labelModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
        </select>
      </SettingsRow>
      <SettingsRow title="Note label size" description="Tăng/giảm kích thước nhãn note.">
        <input class="settings-control compact" type="number" min="-10" max="25" step="1" :value="settings.noteLabelSize" @change="settings.setNoteLabelSize(Number(($event.target as HTMLInputElement).value))" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.theme-previews {
  display: grid;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
}

.theme-card {
  width: min(23rem, 100%);
  display: grid;
  gap: 0.7rem;
  padding: 0;
  overflow: hidden;
  border: 2px solid rgba(0, 0, 0, 0.7);
  border-radius: 0;
  background: #353535;
  color: #f4f4f4;
  text-align: center;
}

.theme-card.active {
  outline: 2px solid rgba(198, 210, 40, 0.78);
}

.theme-bar {
  padding: 0.44rem;
  background: #252525;
  font-size: 0.96rem;
}

.theme-card strong {
  justify-self: center;
  width: 65%;
  padding: 0.7rem;
  border-radius: 0.2rem;
  background: #777777;
  font-weight: 500;
}

.theme-row {
  display: flex;
  justify-content: space-between;
  margin: 0 0.6rem 0.8rem;
  padding: 0.46rem;
  border-radius: 0.35rem;
  background: rgba(255, 255, 255, 0.11);
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.78rem;
}

.theme-card.light {
  background: #ececec;
  color: #1f1f1f;
}

.theme-card.light .theme-bar {
  background: #1d86b5;
  color: #fff;
}

.theme-card.light strong {
  background: #1d86b5;
  color: #fff;
}

.theme-card.light .theme-row {
  background: #ffffff;
  color: #526a83;
}
</style>
