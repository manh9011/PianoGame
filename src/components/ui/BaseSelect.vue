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
    <div class="base-select-input-container">
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
      <div class="base-select-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
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

.base-select-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.base-select-field {
  width: 100%;
  padding: 0.55rem;
  padding-right: 2.2rem;
  border: 1px solid var(--color-border-input);
  border-radius: 8px;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
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

.base-select-icon {
  position: absolute;
  right: 0.6rem;
  width: 1.2rem;
  height: 1.2rem;
  pointer-events: none;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
