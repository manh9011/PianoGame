<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseSelect from '../../components/ui/BaseSelect.vue'
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
          <span class="theme-bar">
            <span class="theme-bar-back"><i class="fa-solid fa-chevron-left" /> {{ t('common.back') }}</span>
            <span class="theme-bar-title">{{ t('settings.colorTheme') }}</span>
          </span>
          <strong>{{ t('settings.synthesiaClassic') }}</strong>
          <span class="theme-row">
            <span>{{ t('settings.labels') }}</span>
            <span class="theme-row-link">{{ t('settings.keyLabelMode') }} <i class="fa-solid fa-chevron-right" /></span>
          </span>
          <span class="theme-desc">{{ t('settings.colorThemeDescription') }}</span>
        </button>
        <button class="theme-card light" :class="{ active: settings.theme === 'light' }" type="button" @click="settings.setTheme('light')">
          <span class="theme-bar">
            <span class="theme-bar-back"><i class="fa-solid fa-chevron-left" /> {{ t('common.back') }}</span>
            <span class="theme-bar-title">{{ t('settings.colorTheme') }}</span>
          </span>
          <strong>{{ t('settings.crystalLight') }}</strong>
          <span class="theme-row">
            <span>{{ t('settings.labels') }}</span>
            <span class="theme-row-link">{{ t('settings.keyLabelMode') }} <i class="fa-solid fa-chevron-right" /></span>
          </span>
          <span class="theme-desc">{{ t('settings.colorThemeDescription') }}</span>
        </button>
      </div>
    </SettingsSection>

    <SettingsSection :title="t('settings.labels')">
      <SettingsRow :title="t('settings.keyLabels')" :description="t('settings.keyLabelsDescription')">
        <SettingsToggle :model-value="settings.showKeyLabels" @change="settings.setShowKeyLabels($event)" />
      </SettingsRow>
      <SettingsRow :title="t('settings.keyLabelMode')" :description="t('settings.keyLabelModeDescription')">
        <BaseSelect class="settings-control" :model-value="settings.keyLabelMode" @update:model-value="settings.setKeyLabelMode($event as LabelMode)">
          <option v-for="mode in labelModes" :key="mode.value" :value="mode.value">{{ t(mode.labelKey) }}</option>
        </BaseSelect>
      </SettingsRow>
      <SettingsRow :title="t('settings.keyLabelSize')" :description="t('settings.keyLabelSizeDescription')">
        <BaseInput class="settings-control compact" type="number" min="-10" max="25" step="1" :model-value="settings.keyLabelSize" @update:model-value="settings.setKeyLabelSize(Number($event))" />
      </SettingsRow>
      <SettingsRow :title="t('settings.fallingNoteLabels')" :description="t('settings.fallingNoteLabelsDescription')">
        <SettingsToggle :model-value="settings.showNoteLabels" @change="settings.setShowNoteLabels($event)" />
      </SettingsRow>
      <SettingsRow :title="t('settings.noteLabelMode')" :description="t('settings.noteLabelModeDescription')">
        <BaseSelect class="settings-control" :model-value="settings.noteLabelMode" @update:model-value="settings.setNoteLabelMode($event as LabelMode)">
          <option v-for="mode in labelModes" :key="mode.value" :value="mode.value">{{ t(mode.labelKey) }}</option>
        </BaseSelect>
      </SettingsRow>
      <SettingsRow :title="t('settings.noteLabelSize')" :description="t('settings.noteLabelSizeDescription')">
        <BaseInput class="settings-control compact" type="number" min="-10" max="25" step="1" :model-value="settings.noteLabelSize" @update:model-value="settings.setNoteLabelSize(Number($event))" />
      </SettingsRow>
      <SettingsRow :title="t('settings.coloredFingerHints')" :description="t('settings.coloredFingerHintsDescription')">
        <SettingsToggle :model-value="settings.showColoredFingerHints" @change="settings.setShowColoredFingerHints($event)" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.theme-previews {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
}

.theme-card {
  width: min(30rem, 100%);
  display: grid;
  gap: 0;
  padding: 0;
  overflow: hidden;
  border: 2px solid rgba(0, 0, 0, 0.7);
  border-radius: 0.3rem;
  background: #353535;
  color: #f4f4f4;
  text-align: center;
  cursor: pointer;
  transition: transform 0.12s ease, outline-color 0.12s ease;
}

.theme-card:hover {
  transform: scale(1.012);
}

.theme-card.active {
  outline: 2px solid rgba(198, 210, 40, 0.82);
  outline-offset: 2px;
}

/* Header bar */
.theme-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0.65rem 1rem;
  background: #252525;
  font-size: 0.96rem;
  font-weight: 500;
}

.theme-bar-back {
  position: absolute;
  left: 0.8rem;
  font-size: 0.75rem;
  font-weight: 400;
  opacity: 0.6;
}

.theme-bar-title {
  pointer-events: none;
}

/* Theme name button */
.theme-card strong {
  display: block;
  width: 80%;
  margin: 1rem auto;
  padding: 0.85rem 1rem;
  border-radius: 0.2rem;
  background: #777777;
  color: inherit;
  font-weight: 500;
  font-size: 1rem;
}

/* Settings-like row */
.theme-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.35rem;
  background: rgba(255, 255, 255, 0.11);
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.82rem;
}

.theme-row-link {
  color: rgba(255, 255, 255, 0.42);
}

/* Description */
.theme-desc {
  display: block;
  margin: 0.5rem 0.75rem 1rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.38);
  text-align: center;
  line-height: 1.4;
}

/* Light theme variant */
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

.theme-card.light .theme-row-link {
  color: #8fa5be;
}

.theme-card.light .theme-desc {
  color: rgba(0, 0, 0, 0.35);
}
</style>
