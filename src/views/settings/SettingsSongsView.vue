<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import FolderSelector from '../../components/library/FolderSelector.vue'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import { useSettingsStore } from '../../stores/settingsStore'

const { t } = useI18n()
const settings = useSettingsStore()

function removeFolder(folder: string) {
  settings.patchSettings({ folders: settings.folders.filter(item => item !== folder) })
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>{{ t('settings.songs') }}</h2>
        <p>{{ t('settings.songsDescription') }}</p>
      </div>
      <span class="settings-pill">{{ t('settings.folders', { count: settings.folders.length }) }}</span>
    </header>

    <SettingsSection :title="t('settings.songLocations')" :description="t('settings.songLocationsDescription')">
      <SettingsRow :title="t('settings.addSongsFolder')" :description="t('settings.addSongsFolderDescription')" align="start">
        <FolderSelector />
      </SettingsRow>
      <SettingsRow v-for="folder in settings.folders" :key="folder" :title="folder" :description="t('settings.savedFolderDescription')">
        <button class="settings-button danger" type="button" @click="removeFolder(folder)">{{ t('settings.remove') }}</button>
      </SettingsRow>
      <SettingsRow v-if="!settings.folders.length" :title="t('settings.noFolders')" :description="t('settings.noFoldersDescription')">
        <span class="settings-pill">{{ t('settings.empty') }}</span>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.libraryBehavior')" :note="t('settings.libraryBehaviorNote')">
      <SettingsRow :title="t('settings.rescanOnStartup')" :description="t('settings.rescanOnStartupDescription')">
        <SettingsToggle :model-value="settings.songsRescanOnStartup" @change="settings.patchSettings({ songsRescanOnStartup: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.rememberLastFolder')" :description="t('settings.rememberLastFolderDescription')">
        <SettingsToggle :model-value="settings.songsRememberLastFolder" @change="settings.patchSettings({ songsRememberLastFolder: $event })" />
      </SettingsRow>
      <SettingsRow :title="t('settings.recentlyImportedFirst')" :description="t('settings.recentlyImportedFirstDescription')">
        <SettingsToggle :model-value="settings.songsSortByRecentlyImported" @change="settings.patchSettings({ songsSortByRecentlyImported: $event })" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
