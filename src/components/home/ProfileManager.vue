<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProfileStore } from '../../stores/profileStore'
import BaseButton from '../ui/BaseButton.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseSelect from '../ui/BaseSelect.vue'
const { t } = useI18n()
const profiles = useProfileStore()
const name = ref('')
function create() { const value = name.value.trim(); if (!value) return; profiles.createProfile(value); name.value = '' }
</script>

<template>
  <section class="panel grid">
    <h2>{{ t('profile.localProfiles') }}</h2>
    <div class="row" style="display: flex; gap: 8px; flex-wrap: wrap;">
      <BaseSelect
        :model-value="profiles.activeProfile.id"
        style="flex: 1; min-width: 150px;"
        @update:model-value="profiles.selectProfile($event as string)"
      >
        <option v-for="profile in profiles.profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
      </BaseSelect>
      <BaseInput
        v-model="name"
        :placeholder="t('profile.newProfileName')"
        style="flex: 1; min-width: 150px;"
        @keyup.enter="create"
      />
      <BaseButton variant="primary" @click="create">{{ t('common.create') }}</BaseButton>
      <BaseButton variant="danger" :disabled="profiles.profiles.length <= 1" @click="profiles.deleteProfile(profiles.activeProfile.id)">
        {{ t('common.delete') }}
      </BaseButton>
    </div>
  </section>
</template>
