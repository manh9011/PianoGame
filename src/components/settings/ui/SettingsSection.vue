<script setup lang="ts">
defineProps<{ title?: string; description?: string; note?: string }>()
</script>

<template>
  <section class="settings-section">
    <header v-if="title || description" class="settings-section-header">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </header>
    <div class="settings-section-body">
      <slot />
    </div>
    <p v-if="note" class="settings-section-note">{{ note }}</p>
  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  gap: 0.38rem;
}

.settings-section-header {
  display: grid;
  gap: 0.22rem;
  padding: 0 0.25rem;
}

.settings-section-header h2 {
  margin: 0;
  color: rgba(255, 255, 255, 0.66);
  font-size: 0.86rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.settings-section-header p,
.settings-section-note {
  margin: 0;
  color: rgba(255, 255, 255, 0.43);
  font-size: 0.73rem;
  line-height: 1.45;
}

.settings-section-body {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 0.62rem;
  background: linear-gradient(#3d3d3d, #343434);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 1px 2px rgba(0, 0, 0, 0.28);
}

.settings-section-note {
  padding: 0 0.25rem;
  text-align: center;
}

.settings-section :deep(.settings-control) {
  min-width: min(18rem, 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.36rem;
  padding: 0.44rem 0.58rem;
  background: linear-gradient(#303030, #242424);
  color: rgba(255, 255, 255, 0.88);
}

.settings-section :deep(.settings-control.compact) {
  min-width: 7rem;
}

.settings-section :deep(.settings-button) {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.38rem;
  padding: 0.48rem 0.8rem;
  background: linear-gradient(#666666, #505050);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.settings-section :deep(.settings-button:hover) {
  background: linear-gradient(#737373, #5b5b5b);
}

.settings-section :deep(.settings-button.primary) {
  background: linear-gradient(#5ea85d, #438b43);
}

.settings-section :deep(.settings-button.danger) {
  background: linear-gradient(#9d4a4a, #7b3030);
}

.settings-section :deep(.settings-pill) {
  padding: 0.24rem 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.72rem;
}

@media (max-width: 760px) {
  .settings-section :deep(.settings-control) {
    width: 100%;
  }
}
</style>
