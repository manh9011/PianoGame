<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import { useProfileStore } from '../../stores/profileStore'

const { t } = useI18n()
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
        <h2>{{ t('settings.userProfiles') }}</h2>
        <p>{{ t('settings.userProfilesDescription') }}</p>
      </div>
      <span class="settings-pill">{{ t('settings.profiles', { count: profiles.profiles.length }) }}</span>
    </header>

    <SettingsSection :title="t('settings.userProfiles')">
      <SettingsRow :title="t('settings.activeProfile')" :description="t('settings.activeProfileDescription')">
        <select class="settings-control" :value="profiles.activeProfile.id" @change="profiles.selectProfile(($event.target as HTMLSelectElement).value)">
          <option v-for="profile in profiles.profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
        </select>
      </SettingsRow>
      <SettingsRow :title="t('settings.newProfile')" :description="t('settings.newProfileDescription')">
        <div class="profile-actions">
          <input v-model="name" class="settings-control" :placeholder="t('profile.newProfileName')" @keyup.enter="createProfile" />
          <button class="settings-button primary" type="button" @click="createProfile">{{ t('common.save') }}</button>
        </div>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('settings.profileList')">
      <SettingsRow v-for="profile in profiles.profiles" :key="profile.id" :title="profile.name" :description="profile.id === profiles.activeProfile.id ? t('settings.activeProfileStatus') : t('settings.localProfileStatus')">
        <button class="settings-button" type="button" :disabled="profile.id === profiles.activeProfile.id" @click="profiles.selectProfile(profile.id)">{{ t('settings.useProfile') }}</button>
        <button class="settings-button danger" type="button" :disabled="profiles.profiles.length <= 1" @click="profiles.deleteProfile(profile.id)">{{ t('common.delete') }}</button>
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
