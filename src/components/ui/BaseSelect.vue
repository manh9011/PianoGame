<script setup lang="ts">
defineOptions({ inheritAttrs: false })
interface SelectOption {
  value: string
  label: string
}

interface Props {
  modelValue: string | number
  options?: SelectOption[]
  disabled?: boolean
  label?: string
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  options: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'change': [value: string | number]
}>()

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
  emit('change', target.value)
}
</script>

<template>
  <div class="base-select" :class="{ 'has-label': !!label }">
    <label v-if="label" class="base-select-label">{{ label }}</label>
    <select
      :value="modelValue"
      :disabled="disabled"
      class="base-select-field"
      v-bind="$attrs"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >{{ opt.label }}</option>
      <slot></slot>
    </select>
  </div>
</template>

<style scoped>
.base-select {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.base-select-label {
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
}

.base-select-field {
  width: 100%;
  padding: 0.55rem;
  border: 1px solid var(--color-border-input);
  border-radius: 8px;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.base-select-field:focus {
  border-color: var(--color-border-strong);
}

.base-select-field:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.base-select-field option {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
}
</style>
