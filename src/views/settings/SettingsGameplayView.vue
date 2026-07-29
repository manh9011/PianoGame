<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import type { KeyboardRangeMode } from '../../types/settings'
import { useSettingsStore } from '../../stores/settingsStore'

const { t } = useI18n()
const settings = useSettingsStore()

const keyboardRangeOptions: Array<{ value: KeyboardRangeMode; labelKey: string }> = [
  { value: '18-keys', labelKey: 'settings.keyboardRangeOptions.keys18' },
  { value: '25-keys', labelKey: 'settings.keyboardRangeOptions.keys25' },
  { value: '88-keys', labelKey: 'settings.keyboardRangeOptions.keys88' },
  { value: 'my-notes', labelKey: 'settings.keyboardRangeOptions.myNotes' },
  { value: 'my-keyboard', labelKey: 'settings.keyboardRangeOptions.myKeyboard' },
  { value: 'song-only', labelKey: 'settings.keyboardRangeOptions.songOnly' },
  { value: 'custom', labelKey: 'settings.keyboardRangeOptions.custom' },
]
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>{{ t('settings.gameplay') }}</h2>
        <p>{{ t('settings.gameplayDescription') }}</p>
      </div>
    </header>

    <SettingsSection :title="t('settings.playControls')">
      <SettingsRow :title="t('settings.defaultSpeed')" :description="t('settings.defaultSpeedDescription')">
        <input class="settings-control compact" type="number" min="0" max="400" step="10" :value="settings.defaultSpeed" @change="settings.setSpeed(Number(($event.target as HTMLInputElement).value))" />
        <span class="unit">%</span>
      </SettingsRow>
      <SettingsRow :title="t('settings.showDuration')" :description="t('settings.showDurationDescription')">
        <input class="settings-control compact" type="number" min="0.25" max="10" step="0.25" :value="settings.showDuration" @change="settings.setShowDuration(Number(($event.target as HTMLInputElement).value))" />
        <span class="unit">s</span>
      </SettingsRow>
      <SettingsRow :title="t('settings.inputOctaveShift')" :description="t('settings.inputOctaveShiftDescription')">
        <input class="settings-control compact" type="number" min="-4" max="4" step="1" :value="settings.octaveShift" @change="settings.patchSettings({ octaveShift: Number(($event.target as HTMLInputElement).value) })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.keyboardRange')" :description="t('settings.keyboardRangeDescription')">
        <select class="settings-control" :value="settings.keyboardRangeMode" @change="settings.setKeyboardRangeMode(($event.target as HTMLSelectElement).value as KeyboardRangeMode)">
          <option v-for="option in keyboardRangeOptions" :key="option.value" :value="option.value">{{ t(option.labelKey) }}</option>
        </select>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.displayDuringPlay')">
      <SettingsRow :title="t('settings.fallingNotes')" :description="t('settings.fallingNotesDescription')">
        <SettingsToggle :model-value="settings.showFallingNotes" @change="settings.patchSettings({ showFallingNotes: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.fallingMeasureLines')" :description="t('settings.fallingMeasureLinesDescription')">
        <SettingsToggle :model-value="settings.showGrid" @change="settings.patchSettings({ showGrid: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.sheetMusic')" :description="t('settings.sheetMusicDescription')">
        <SettingsToggle :model-value="settings.showSheetMusic" @change="settings.patchSettings({ showSheetMusic: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.metronome')">
      <SettingsRow :title="t('settings.volume')" :description="t('settings.volumeDescription')">
        <input class="settings-control compact" type="range" min="0" max="100" step="5" :value="settings.metronomeVolume" @input="settings.setMetronomeVolume(Number(($event.target as HTMLInputElement).value))" />
        <span class="unit">{{ settings.metronomeVolume }}%</span>
      </SettingsRow>
      <SettingsRow :title="t('settings.doubleSpeed')" :description="t('settings.doubleSpeedDescription')">
        <SettingsToggle :model-value="settings.metronomeDoubleSpeed" @change="settings.setMetronomeDoubleSpeed($event)" />
      </SettingsRow>
      <SettingsRow :title="t('settings.emphasizeFirstBeat')" :description="t('settings.emphasizeFirstBeatDescription')">
        <SettingsToggle :model-value="settings.metronomeEmphasizeFirstBeat" @change="settings.setMetronomeEmphasizeFirstBeat($event)" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.unit {
  min-width: 2.4rem;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  text-align: end;
}
</style>

