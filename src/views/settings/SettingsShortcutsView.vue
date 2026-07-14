<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import { useSettingsStore } from '../../stores/settingsStore'

const { t } = useI18n()
const settings = useSettingsStore()
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>{{ t('settings.shortcuts') }}</h2>
        <p>{{ t('settings.shortcutsDescription') }}</p>
      </div>
      <span class="settings-pill">{{ t('settings.uiOnly') }}</span>
    </header>

    <SettingsSection :title="t('settings.playControls')" :note="t('settings.shortcutsNote')">
      <SettingsRow :title="t('settings.pauseResume')" :description="t('settings.pauseResumeDescription')">
        <input class="settings-control" :value="settings.shortcutsPlayPauseKey" @change="settings.patchSettings({ shortcutsPlayPauseKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.restartSong')" :description="t('settings.restartSongDescription')">
        <input class="settings-control" :value="settings.shortcutsRestartKey" @change="settings.patchSettings({ shortcutsRestartKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.toggleMetronome')" :description="t('settings.toggleMetronomeDescription')">
        <input class="settings-control" :value="settings.shortcutsMetronomeKey" @change="settings.patchSettings({ shortcutsMetronomeKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.toggleLabels')" :description="t('settings.toggleLabelsDescription')">
        <input class="settings-control" :value="settings.shortcutsToggleLabelsKey" @change="settings.patchSettings({ shortcutsToggleLabelsKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
