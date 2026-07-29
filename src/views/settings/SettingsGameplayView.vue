<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseSelect from '../../components/ui/BaseSelect.vue'
import BaseSlider from '../../components/ui/BaseSlider.vue'
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
        <BaseInput class="settings-control compact" type="number" min="0" max="400" step="10" :model-value="settings.defaultSpeed" @update:model-value="settings.setSpeed(Number($event))" />
        <span class="unit">%</span>
      </SettingsRow>
      <SettingsRow :title="t('settings.showDuration')" :description="t('settings.showDurationDescription')">
        <BaseInput class="settings-control compact" type="number" min="0.25" max="10" step="0.25" :model-value="settings.showDuration" @update:model-value="settings.setShowDuration(Number($event))" />
        <span class="unit">s</span>
      </SettingsRow>
      <SettingsRow :title="t('settings.inputOctaveShift')" :description="t('settings.inputOctaveShiftDescription')">
        <BaseInput class="settings-control compact" type="number" min="-4" max="4" step="1" :model-value="settings.octaveShift" @update:model-value="settings.patchSettings({ octaveShift: Number($event) })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.keyboardRange')" :description="t('settings.keyboardRangeDescription')">
        <BaseSelect class="settings-control" :model-value="settings.keyboardRangeMode" @update:model-value="settings.setKeyboardRangeMode($event as KeyboardRangeMode)">
          <option v-for="option in keyboardRangeOptions" :key="option.value" :value="option.value">{{ t(option.labelKey) }}</option>
        </BaseSelect>
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
        <BaseSlider class="compact" :min="0" :max="100" :step="5" :model-value="settings.metronomeVolume" @update:model-value="settings.setMetronomeVolume($event)" style="flex: 1" />
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

