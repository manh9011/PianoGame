<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  label?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <label class="base-checkbox" :class="{ disabled }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="base-checkbox-input"
      @change="onChange"
    />
    <span class="base-checkbox-check" />
    <span v-if="label" class="base-checkbox-label">{{ label }}</span>
  </label>
</template>

<style scoped>
.base-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.base-checkbox.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.base-checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.base-checkbox-check {
  width: 1.1rem;
  height: 1.1rem;
  border: 1px solid var(--color-border-default);
  border-radius: 3px;
  background: var(--color-bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.16s ease;
  position: relative;
}

.base-checkbox-input:checked + .base-checkbox-check {
  background: var(--color-theme-toggle);
  border-color: var(--color-theme-toggle);
}

.base-checkbox-input:checked + .base-checkbox-check::after {
  content: '';
  width: 0.35rem;
  height: 0.6rem;
  border: solid var(--color-text-inverse);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  position: absolute;
  top: 0.1rem;
}

.base-checkbox-label {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}
</style>
