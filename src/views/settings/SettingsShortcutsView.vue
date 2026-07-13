<script setup lang="ts">
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>Shortcuts</h2>
        <p>Cấu hình phím tắt theo phong cách danh sách của Synthesia.</p>
      </div>
      <span class="settings-pill">UI only</span>
    </header>

    <SettingsSection title="Play Controls" note="Các phím tắt này hiện chỉ được lưu vào store; phần bind keyboard thật sẽ tích hợp sau.">
      <SettingsRow title="Pause/Resume" description="Phím dùng để tạm dừng hoặc tiếp tục bài hát.">
        <input class="settings-control" :value="settings.shortcutsPlayPauseKey" @change="settings.patchSettings({ shortcutsPlayPauseKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow title="Restart Song" description="Phím quay lại đầu bài hoặc restart loop.">
        <input class="settings-control" :value="settings.shortcutsRestartKey" @change="settings.patchSettings({ shortcutsRestartKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow title="Toggle Metronome" description="Bật/tắt metronome trong lúc chơi.">
        <input class="settings-control" :value="settings.shortcutsMetronomeKey" @change="settings.patchSettings({ shortcutsMetronomeKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow title="Toggle Labels" description="Bật/tắt nhãn nốt/phím nhanh.">
        <input class="settings-control" :value="settings.shortcutsToggleLabelsKey" @change="settings.patchSettings({ shortcutsToggleLabelsKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
