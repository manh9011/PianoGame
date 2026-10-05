<script setup lang="ts">
interface Props {
  variant?: 'header' | 'toolbar' | 'footer'
}

withDefaults(defineProps<Props>(), {
  variant: 'toolbar',
})
</script>

<template>
  <header v-if="variant === 'header'" class="base-toolbar base-toolbar-header">
    <div class="base-toolbar-left">
      <slot name="left" />
    </div>
    <div class="base-toolbar-center">
      <slot name="center" />
    </div>
    <div class="base-toolbar-right">
      <slot name="right" />
    </div>
  </header>
  <footer v-else-if="variant === 'footer'" class="base-toolbar base-toolbar-footer">
    <div class="base-toolbar-left">
      <slot name="left" />
    </div>
    <div class="base-toolbar-center">
      <slot name="center" />
    </div>
    <div class="base-toolbar-right">
      <slot name="right" />
    </div>
  </footer>
  <div v-else class="base-toolbar base-toolbar-default">
    <div class="base-toolbar-left">
      <slot name="left" />
    </div>
    <div class="base-toolbar-center">
      <slot name="center" />
    </div>
    <div class="base-toolbar-right">
      <slot name="right" />
    </div>
  </div>
</template>

<style scoped>
.base-toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border-subtle);
  min-height: 48px;
}

.base-toolbar-default,
.base-toolbar-footer {
  background: var(--color-bg-tertiary);
}

.base-toolbar-footer {
  border-bottom: none;
  border-top: 1px solid var(--color-border-subtle);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.base-toolbar-left {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.base-toolbar-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-self: end;
}

.base-toolbar-center {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
}

@media (max-width: 900px) {
  .base-toolbar {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .base-toolbar-left,
  .base-toolbar-center,
  .base-toolbar-right {
    justify-content: center;
  }
}
</style>
