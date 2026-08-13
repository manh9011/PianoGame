<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/ui/BaseButton.vue'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <div class="chord-visualizer-container">
    <header class="topbar">
      <BaseButton variant="secondary" @click="router.push('/')">
        {{ t('common.back') }}
      </BaseButton>
      <h1 class="title">{{ t('home.chordVisualizer') }} (BETA)</h1>
      <!-- Placeholder div to balance the flex space -->
      <div style="width: 80px"></div>
    </header>

    <main class="content">
      <iframe src="https://chordvisualizer.vercel.app/" class="chord-iframe" allow="midi" frameborder="0"></iframe>
    </main>
  </div>
</template>

<style scoped>
.chord-visualizer-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.chord-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
}
</style>
