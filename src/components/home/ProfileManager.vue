<script setup lang="ts">
import { ref } from 'vue'
import { useProfileStore } from '../../stores/profileStore'
const profiles = useProfileStore()
const name = ref('')
function create() { const value = name.value.trim(); if (!value) return; profiles.createProfile(value); name.value = '' }
</script>

<template>
  <section class="panel grid">
    <h2>Profile cục bộ</h2>
    <div class="row">
      <select :value="profiles.activeProfile.id" @change="profiles.selectProfile(($event.target as HTMLSelectElement).value)">
        <option v-for="profile in profiles.profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
      </select>
      <input v-model="name" placeholder="Tên profile mới" @keyup.enter="create" />
      <button @click="create">Tạo</button>
      <button class="danger" :disabled="profiles.profiles.length <= 1" @click="profiles.deleteProfile(profiles.activeProfile.id)">Xóa</button>
    </div>
  </section>
</template>
