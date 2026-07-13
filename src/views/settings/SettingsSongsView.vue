<script setup lang="ts">
import FolderSelector from '../../components/library/FolderSelector.vue'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()

function removeFolder(folder: string) {
  settings.patchSettings({ folders: settings.folders.filter(item => item !== folder) })
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>Songs</h2>
        <p>Quản lý vị trí chứa MIDI và các tùy chọn duyệt bài hát.</p>
      </div>
      <span class="settings-pill">{{ settings.folders.length }} folders</span>
    </header>

    <SettingsSection title="Song Locations" description="Các folder này được dùng cho thư viện bài hát.">
      <SettingsRow title="Add songs folder" description="Chọn thư mục MIDI giống mục Songs trong Synthesia." align="start">
        <FolderSelector />
      </SettingsRow>
      <SettingsRow v-for="folder in settings.folders" :key="folder" :title="folder" description="Folder đã lưu trong settings store.">
        <button class="settings-button danger" type="button" @click="removeFolder(folder)">Remove</button>
      </SettingsRow>
      <SettingsRow v-if="!settings.folders.length" title="No folders" description="Chưa có thư mục bài hát nào được thêm.">
        <span class="settings-pill">Empty</span>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="Library Behavior" note="Các tùy chọn này hiện chỉ lưu vào store; chức năng scan/sort thật sẽ tích hợp sau.">
      <SettingsRow title="Rescan on startup" description="Tự quét lại thư viện khi mở app.">
        <SettingsToggle :model-value="settings.songsRescanOnStartup" @change="settings.patchSettings({ songsRescanOnStartup: $event })" />
      </SettingsRow>
      <SettingsRow title="Remember last selected folder" description="Ghi nhớ folder gần nhất bạn thao tác.">
        <SettingsToggle :model-value="settings.songsRememberLastFolder" @change="settings.patchSettings({ songsRememberLastFolder: $event })" />
      </SettingsRow>
      <SettingsRow title="Recently imported first" description="Ưu tiên bài hát mới import ở đầu danh sách.">
        <SettingsToggle :model-value="settings.songsSortByRecentlyImported" @change="settings.patchSettings({ songsSortByRecentlyImported: $event })" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
