<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'text'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  active?: boolean
  title?: string
  ariaLabel?: string
  type?: 'button' | 'submit'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  active: false,
  type: 'button',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <button
    :class="['base-btn', `variant-${variant}`, `size-${size}`, { active }]"
    :disabled="disabled"
    :title="title"
    :aria-label="ariaLabel"
    :type="type"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
}

.base-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Sizes */
.size-sm { padding: 0.3rem 0.55rem; font-size: 0.8rem; }
.size-md { padding: 0.4rem 0.75rem; font-size: 0.9rem; }
.size-lg { padding: 0.65rem 0.9rem; font-size: 1rem; }

/* Variants */
.variant-primary {
  background: var(--color-btn-primary-bg);
  color: var(--color-btn-primary-text);
  border-color: transparent;
}
.variant-primary:hover:not(:disabled) {
  background: var(--color-btn-primary-hover);
}

.variant-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}
.variant-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.variant-danger {
  background: var(--color-btn-danger-bg);
  color: var(--color-btn-danger-text);
  border-color: transparent;
}
.variant-danger:hover:not(:disabled) {
  background: var(--color-btn-danger-hover);
}

.variant-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
  font-size: 1.1rem;
}
.variant-icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
}
.variant-icon.active {
  color: var(--color-accent-amber);
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.variant-text {
  background: transparent;
  color: var(--color-text-primary);
  border-color: transparent;
  padding: 0.3rem 0.5rem;
}
.variant-text:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

/* Active state for toggle-style buttons */
.base-btn.active:not(.variant-primary):not(.variant-danger):not(.variant-text) {
  color: var(--color-accent-amber);
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}
.base-btn.active:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.25);
  border-color: rgba(251, 191, 36, 0.5);
}
</style>
