<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import { useSettingsStore } from '../../stores/settingsStore'

const { t } = useI18n()
const settings = useSettingsStore()
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>{{ t('settings.advanced') }}</h2>
        <p>{{ t('settings.advancedDescription') }}</p>
      </div>
      <span class="settings-pill">{{ t('settings.saved') }}</span>
    </header>

    <SettingsSection :title="t('settings.interface')">
      <SettingsRow :title="t('settings.reduceMotion')" :description="t('settings.reduceMotionDescription')">
        <SettingsToggle :model-value="settings.advancedReduceAnimations" @change="settings.patchSettings({ advancedReduceAnimations: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.compactMode')" :description="t('settings.compactModeDescription')">
        <SettingsToggle :model-value="settings.advancedCompactMode" @change="settings.patchSettings({ advancedCompactMode: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.confirmDestructive')" :description="t('settings.confirmDestructiveDescription')">
        <SettingsToggle :model-value="settings.advancedConfirmBeforeDestructiveAction" @change="settings.patchSettings({ advancedConfirmBeforeDestructiveAction: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.diagnostics')" :note="t('settings.diagnosticsNote')">
      <SettingsRow :title="t('settings.debugOverlay')" :description="t('settings.debugOverlayDescription')">
        <SettingsToggle :model-value="settings.advancedEnableDebugOverlay" @change="settings.patchSettings({ advancedEnableDebugOverlay: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.resetToDefaults')" :description="t('settings.resetToDefaultsDescription')">
        <button class="settings-button" type="button" disabled>{{ t('settings.resetToDefaults') }}</button>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
