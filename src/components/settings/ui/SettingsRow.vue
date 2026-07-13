<script setup lang="ts">
defineProps<{ title: string; description?: string; align?: 'center' | 'start' }>()
</script>

<template>
  <div class="settings-row" :class="{ start: align === 'start' }">
    <div class="settings-row-copy">
      <span class="settings-row-title">{{ title }}</span>
      <span v-if="description" class="settings-row-description">{{ description }}</span>
    </div>
    <div class="settings-row-control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, auto);
  align-items: center;
  gap: 1rem;
  min-height: 2.58rem;
  padding: 0.46rem 0.62rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.015);
}

.settings-row:first-child {
  border-top-left-radius: 0.55rem;
  border-top-right-radius: 0.55rem;
}

.settings-row:last-child {
  border-bottom: 0;
  border-bottom-right-radius: 0.55rem;
  border-bottom-left-radius: 0.55rem;
}

.settings-row.start {
  align-items: start;
}

.settings-row-copy {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.settings-row-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.94rem;
}

.settings-row-description {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.74rem;
  line-height: 1.35;
}

.settings-row-control {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.55rem;
  color: rgba(255, 255, 255, 0.78);
}

@media (max-width: 760px) {
  .settings-row {
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }

  .settings-row-control {
    justify-content: stretch;
  }
}
</style>
