<script setup lang="ts">
import { ref } from 'vue'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import { useProfileStore } from '../../stores/profileStore'

const profiles = useProfileStore()
const name = ref('')

function createProfile() {
  const value = name.value.trim()
  if (!value) return
  profiles.createProfile(value)
  name.value = ''
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>User Profiles</h2>
        <p>Chọn profile luyện tập và lưu tiến trình cục bộ.</p>
      </div>
      <span class="settings-pill">{{ profiles.profiles.length }} profiles</span>
    </header>

    <SettingsSection title="Profiles">
      <SettingsRow title="Active profile" description="Profile đang được dùng để lưu điểm và bài gần đây.">
        <select class="settings-control" :value="profiles.activeProfile.id" @change="profiles.selectProfile(($event.target as HTMLSelectElement).value)">
          <option v-for="profile in profiles.profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
        </select>
      </SettingsRow>
      <SettingsRow title="New profile" description="Tạo profile mới và chuyển sang dùng ngay.">
        <div class="profile-actions">
          <input v-model="name" class="settings-control" placeholder="Name" @keyup.enter="createProfile" />
          <button class="settings-button primary" type="button" @click="createProfile">Save</button>
        </div>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="Profile List">
      <SettingsRow v-for="profile in profiles.profiles" :key="profile.id" :title="profile.name" :description="profile.id === profiles.activeProfile.id ? 'Profile đang hoạt động' : 'Profile cục bộ'">
        <button class="settings-button" type="button" :disabled="profile.id === profiles.activeProfile.id" @click="profiles.selectProfile(profile.id)">Use</button>
        <button class="settings-button danger" type="button" :disabled="profiles.profiles.length <= 1" @click="profiles.deleteProfile(profile.id)">Delete</button>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.profile-actions {
  display: flex;
  min-width: min(28rem, 100%);
  gap: 0.5rem;
}

.profile-actions input {
  flex: 1;
}

@media (max-width: 760px) {
  .profile-actions {
    width: 100%;
    flex-direction: column;
  }
}
</style>
