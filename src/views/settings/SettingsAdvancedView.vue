<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import BaseSelect from '../../components/ui/BaseSelect.vue'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConfirmDialog } from '../../composables/useConfirmDialog'

const { t } = useI18n()
const settings = useSettingsStore()
const { confirm } = useConfirmDialog()

async function resetAdvanced() {
  const confirmed = await confirm({
    message: t('settings.resetAdvancedConfirm'),
    confirmLabel: t('settings.resetToDefaults'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
  if (!confirmed) return
  settings.resetAdvancedSettings()
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>{{ t('settings.advanced') }}</h2>
        <p>{{ t('settings.advancedDescription') }}</p>
      </div>
    </header>

    <SettingsSection :title="t('settings.interface')">
      <SettingsRow :title="t('settings.reduceMotion')" :description="t('settings.reduceMotionDescription')">
        <SettingsToggle :model-value="settings.advancedReduceAnimations"
          @change="settings.patchSettings({ advancedReduceAnimations: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.compactMode')" :description="t('settings.compactModeDescription')">
        <SettingsToggle :model-value="settings.advancedCompactMode"
          @change="settings.patchSettings({ advancedCompactMode: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.confirmDestructive')" :description="t('settings.confirmDestructiveDescription')">
        <SettingsToggle :model-value="settings.advancedConfirmBeforeDestructiveAction"
          @change="settings.patchSettings({ advancedConfirmBeforeDestructiveAction: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.midiData')">
      <SettingsRow :title="t('settings.midiInstrumentChange')">
        <SettingsToggle :model-value="settings.advancedMidiInstrumentChange"
          @change="settings.patchSettings({ advancedMidiInstrumentChange: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.midiBankSelect')">
        <SettingsToggle :model-value="settings.advancedMidiBankSelect"
          @change="settings.patchSettings({ advancedMidiBankSelect: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.midiSysEx')">
        <SettingsToggle :model-value="settings.advancedMidiSysEx"
          @change="settings.patchSettings({ advancedMidiSysEx: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.midiPedal')">
        <SettingsToggle :model-value="settings.advancedMidiPedal"
          @change="settings.patchSettings({ advancedMidiPedal: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.midiZeroVolumeKeyLights')">
        <SettingsToggle :model-value="settings.advancedMidiZeroVolumeKeyLights"
          @change="settings.patchSettings({ advancedMidiZeroVolumeKeyLights: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.midiForceUniqueTrackChannels')">
        <SettingsToggle :model-value="settings.advancedMidiForceUniqueTrackChannels"
          @change="settings.patchSettings({ advancedMidiForceUniqueTrackChannels: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.converter')">
      <SettingsRow :title="t('settings.midiToMusicXml')">
        <BaseSelect class="settings-control" :model-value="settings.advancedConverterMidiToMusicXml"
          @update:model-value="settings.patchSettings({ advancedConverterMidiToMusicXml: $event as 'music21' | 'webmscore' })">
          <option value="music21">music21</option>
          <option value="webmscore">webmscore</option>
        </BaseSelect>
      </SettingsRow>
      <SettingsRow :title="t('settings.musicXmlToMidi')">
        <BaseSelect class="settings-control" :model-value="settings.advancedConverterMusicXmlToMidi"
          @update:model-value="settings.patchSettings({ advancedConverterMusicXmlToMidi: $event as 'verovio' | 'webmscore' })">
          <option value="verovio">verovio</option>
          <option value="webmscore">webmscore</option>
        </BaseSelect>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.diagnostics')">
      <SettingsRow :title="t('settings.debugOverlay')" :description="t('settings.debugOverlayDescription')">
        <SettingsToggle :model-value="settings.advancedEnableDebugOverlay"
          @change="settings.patchSettings({ advancedEnableDebugOverlay: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.resetToDefaults')" :description="t('settings.resetToDefaultsDescription')">
        <button class="settings-button danger" type="button" @click="resetAdvanced">{{ t('settings.resetToDefaults') }}</button>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
