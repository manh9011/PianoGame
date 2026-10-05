<script setup lang="ts">
defineOptions({ inheritAttrs: false })
interface Props {
  modelValue: string | number
  type?: 'text' | 'number' | 'search'
  placeholder?: string
  disabled?: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'change': [value: string | number]
}>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('change', target.value)
}
</script>

<template>
  <div class="base-input" :class="{ 'has-label': !!label }">
    <label v-if="label" class="base-input-label">{{ label }}</label>
    <input
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      class="base-input-field"
      v-bind="$attrs"
      @input="onInput"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.base-input {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.base-input-label {
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
}

.base-input-field {
  width: 100%;
  padding: 0.55rem;
  border: 1px solid var(--color-border-input);
  border-radius: 8px;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.base-input-field:focus {
  border-color: var(--color-border-strong);
  background: var(--color-bg-input-focus);
}

.base-input-field:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.base-input-field::placeholder {
  color: var(--color-text-muted);
}
</style>
