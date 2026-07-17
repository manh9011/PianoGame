<script setup lang="ts">
import Toast from './components/Toast.vue'
import { RouterView } from 'vue-router'
import { Analytics } from "@vercel/analytics/vue"
</script>

<template>
  <Analytics />
  <Toast />
  <RouterView />
</template>
