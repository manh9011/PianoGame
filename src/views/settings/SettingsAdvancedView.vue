<script setup lang="ts">
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>Advanced</h2>
        <p>Các tùy chọn nâng cao dành cho trải nghiệm và debug.</p>
      </div>
      <span class="settings-pill">Saved</span>
    </header>

    <SettingsSection title="Interface">
      <SettingsRow title="Reduce motion" description="Giảm animation và chuyển động trên giao diện.">
        <SettingsToggle :model-value="settings.advancedReduceAnimations" @change="settings.patchSettings({ advancedReduceAnimations: $event })" />
      </SettingsRow>
      <SettingsRow title="Compact mode" description="Dùng spacing gọn hơn cho các màn có nhiều dữ liệu.">
        <SettingsToggle :model-value="settings.advancedCompactMode" @change="settings.patchSettings({ advancedCompactMode: $event })" />
      </SettingsRow>
      <SettingsRow title="Confirm before destructive actions" description="Hiển thị xác nhận trước khi xóa/import ghi đè.">
        <SettingsToggle :model-value="settings.advancedConfirmBeforeDestructiveAction" @change="settings.patchSettings({ advancedConfirmBeforeDestructiveAction: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="Diagnostics" note="Các setting nâng cao hiện chỉ lưu vào store trong phase giao diện.">
      <SettingsRow title="Debug overlay" description="Hiển thị thông tin debug khi tích hợp ở bước sau.">
        <SettingsToggle :model-value="settings.advancedEnableDebugOverlay" @change="settings.patchSettings({ advancedEnableDebugOverlay: $event })" />
      </SettingsRow>
      <SettingsRow title="Reset to defaults" description="Chức năng reset sẽ được nối logic ở bước sau để tránh mất cấu hình ngoài ý muốn.">
        <button class="settings-button" type="button" disabled>Reset to Defaults</button>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>
