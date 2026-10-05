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
  color: var(--color-text-secondary);
  font-size: 0.86rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.settings-section-header p,
.settings-section-note {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.73rem;
  line-height: 1.45;
}

.settings-section-body {
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  border-radius: 0.62rem;
  background: var(--color-bg-card);
  box-shadow: inset 0 1px 0 var(--color-border-subtle), var(--shadow-sm);
}

.settings-section-note {
  padding: 0 0.25rem;
  text-align: center;
}

.settings-section :deep(.settings-control) {
  min-width: min(18rem, 100%);
  border: 1px solid var(--color-border-input);
  border-radius: 0.36rem;
  padding: 0.44rem 0.58rem;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
}

.settings-section :deep(.settings-control.compact) {
  min-width: 7rem;
}

.settings-section :deep(.settings-button) {
  border: 1px solid var(--color-border-input);
  border-radius: 0.38rem;
  padding: 0.48rem 0.8rem;
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-text);
  box-shadow: inset 0 1px 0 var(--color-border-subtle);
}

.settings-section :deep(.settings-button:hover) {
  background: linear-gradient(#737373, #5b5b5b);
}

.settings-section :deep(.settings-button.primary) {
  background: var(--color-btn-primary-bg);
}

.settings-section :deep(.settings-button.danger) {
  background: var(--color-btn-danger-bg);
}

.settings-section :deep(.settings-pill) {
  padding: 0.24rem 0.5rem;
  border-radius: 999px;
  background: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-size: 0.72rem;
}

@media (max-width: 760px) {
  .settings-section :deep(.settings-control) {
    width: 100%;
  }
}
</style>

