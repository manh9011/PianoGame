<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import type { LabelMode } from '../../types/settings'
import { useSettingsStore } from '../../stores/settingsStore'

const { t } = useI18n()
const settings = useSettingsStore()

const labelModes: Array<{ value: LabelMode; labelKey: string }> = [
  { value: 'octaves', labelKey: 'settings.labelModeOptions.octaves' },
  { value: 'finger-hint', labelKey: 'settings.labelModeOptions.fingerHint' },
  { value: 'virtual-piano', labelKey: 'settings.labelModeOptions.virtualPiano' },
  { value: 'english', labelKey: 'settings.labelModeOptions.english' },
  { value: 'fixed-do', labelKey: 'settings.labelModeOptions.fixedDo' },
  { value: 'movable-do', labelKey: 'settings.labelModeOptions.movableDo' },
  { value: 'scale-number', labelKey: 'settings.labelModeOptions.scaleNumber' },
  { value: 'simple', labelKey: 'settings.labelModeOptions.simple' },
]
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>{{ t('settings.colorTheme') }}</h2>
        <p>{{ t('settings.colorThemeDescription') }}</p>
      </div>
    </header>

    <SettingsSection :title="t('settings.themePreview')">
      <div class="theme-previews">
        <button class="theme-card dark" :class="{ active: settings.theme === 'dark' }" type="button" @click="settings.setTheme('dark')">
          <span class="theme-bar">{{ t('settings.colorTheme') }}</span>
          <strong>{{ t('settings.synthesiaClassic') }}</strong>
          <span class="theme-row">{{ t('settings.labels') }} <i class="fa-solid fa-chevron-right" /></span>
        </button>
        <button class="theme-card light" :class="{ active: settings.theme === 'light' }" type="button" @click="settings.setTheme('light')">
          <span class="theme-bar">{{ t('settings.colorTheme') }}</span>
          <strong>{{ t('settings.crystalLight') }}</strong>
          <span class="theme-row">{{ t('settings.labels') }} <i class="fa-solid fa-chevron-right" /></span>
        </button>
      </div>
    </SettingsSection>

    <SettingsSection :title="t('settings.labels')">
      <SettingsRow :title="t('settings.keyLabels')" :description="t('settings.keyLabelsDescription')">
        <SettingsToggle :model-value="settings.showKeyLabels" @change="settings.setShowKeyLabels($event)" />
      </SettingsRow>
      <SettingsRow :title="t('settings.keyLabelMode')" :description="t('settings.keyLabelModeDescription')">
        <select class="settings-control" :value="settings.keyLabelMode" @change="settings.setKeyLabelMode(($event.target as HTMLSelectElement).value as LabelMode)">
          <option v-for="mode in labelModes" :key="mode.value" :value="mode.value">{{ t(mode.labelKey) }}</option>
        </select>
      </SettingsRow>
      <SettingsRow :title="t('settings.keyLabelSize')" :description="t('settings.keyLabelSizeDescription')">
        <input class="settings-control compact" type="number" min="-10" max="25" step="1" :value="settings.keyLabelSize" @change="settings.setKeyLabelSize(Number(($event.target as HTMLInputElement).value))" />
      </SettingsRow>
      <SettingsRow :title="t('settings.fallingNoteLabels')" :description="t('settings.fallingNoteLabelsDescription')">
        <SettingsToggle :model-value="settings.showNoteLabels" @change="settings.setShowNoteLabels($event)" />
      </SettingsRow>
      <SettingsRow :title="t('settings.noteLabelMode')" :description="t('settings.noteLabelModeDescription')">
        <select class="settings-control" :value="settings.noteLabelMode" @change="settings.setNoteLabelMode(($event.target as HTMLSelectElement).value as LabelMode)">
          <option v-for="mode in labelModes" :key="mode.value" :value="mode.value">{{ t(mode.labelKey) }}</option>
        </select>
      </SettingsRow>
      <SettingsRow :title="t('settings.noteLabelSize')" :description="t('settings.noteLabelSizeDescription')">
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
