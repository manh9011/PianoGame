<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  label?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

function toggle() {
  if (props.disabled) return
  const nextValue = !props.modelValue
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
}
</script>

<template>
  <button
    class="base-toggle"
    type="button"
    :class="{ active: modelValue }"
    :disabled="disabled"
    :aria-pressed="modelValue"
    :aria-label="label"
    @click="toggle"
  >
    <span class="base-toggle-thumb" />
  </button>
</template>

<style scoped>
.base-toggle {
  position: relative;
  width: 3.25rem;
  height: 1.65rem;
  border: 1px solid var(--color-border-default);
  border-radius: 999px;
  padding: 0.12rem;
  background: var(--color-bg-input);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.65), 0 1px 0 var(--color-border-subtle);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.base-toggle.active {
  border-color: var(--color-border-strong);
  background: var(--color-theme-toggle);
}

.base-toggle-thumb {
  display: block;
  width: 1.28rem;
  height: 1.28rem;
  border-radius: 50%;
  background: linear-gradient(#ffffff, #d8d8d8);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  transform: translateX(0);
  transition: transform 0.16s ease;
}

.base-toggle.active .base-toggle-thumb {
  transform: translateX(1.48rem);
}

.base-toggle:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
