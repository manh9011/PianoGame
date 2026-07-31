<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseSelect from '../../components/ui/BaseSelect.vue'
import BaseSlider from '../../components/ui/BaseSlider.vue'
import type { KeyboardRangeMode, LabelMode } from '../../types/settings'
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
        <h2>{{ t('settings.gameplay') }}</h2>
        <p>{{ t('settings.gameplayDescription') }}</p>
      </div>
    </header>

    <SettingsSection :title="t('settings.playControls')">
      <SettingsRow :title="t('settings.defaultSpeed')" :description="t('settings.defaultSpeedDescription')">
        <BaseSlider class="compact" :min="50" :max="200" :step="10" :model-value="settings.defaultSpeed" @update:model-value="settings.setSpeed($event)" style="flex: 1" show-value :format-value="(v) => v + '%'" />
      </SettingsRow>
      <SettingsRow :title="t('settings.showDuration')" :description="t('settings.showDurationDescription')">
        <BaseSlider class="compact" :min="0" :max="10" :step="1" :model-value="settings.showDuration" @update:model-value="settings.setShowDuration($event)" style="flex: 1" show-value :format-value="(v) => v + 's'" />
      </SettingsRow>
      <SettingsRow :title="t('settings.inputOctaveShift')" :description="t('settings.inputOctaveShiftDescription')">
        <BaseSlider class="compact" :min="0" :max="44" :step="1" :model-value="settings.octaveShift" @update:model-value="settings.patchSettings({ octaveShift: Number($event) })" style="flex: 1" show-value />
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
        <BaseSlider class="compact" :min="-10" :max="25" :step="1" :model-value="settings.keyLabelSize" @update:model-value="settings.setKeyLabelSize($event)" style="flex: 1" show-value />
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
        <BaseSlider class="compact" :min="-10" :max="25" :step="1" :model-value="settings.noteLabelSize" @update:model-value="settings.setNoteLabelSize($event)" style="flex: 1" show-value />
      </SettingsRow>
      <SettingsRow :title="t('settings.coloredFingerHints')" :description="t('settings.coloredFingerHintsDescription')">
        <SettingsToggle :model-value="settings.showColoredFingerHints" @change="settings.setShowColoredFingerHints($event)" />
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
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
</style>

