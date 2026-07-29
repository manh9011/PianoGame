<script setup lang="ts" generic="T extends string | number | boolean = string">
export interface BaseOptionItem<V = any> {
  value: V
  label: string
  description?: string
  disabled?: boolean
}

interface Props {
  options: BaseOptionItem<T>[]
  modelValue?: T
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
  select: [option: BaseOptionItem<T>]
}>()

function selectOption(option: BaseOptionItem<T>) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  emit('select', option)
}
</script>

<template>
  <div class="base-options-list" role="radiogroup">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="base-option-item"
      :class="{
        selected: modelValue === option.value,
        disabled: option.disabled
      }"
      :disabled="option.disabled"
      :aria-checked="modelValue === option.value"
      role="radio"
      @click="selectOption(option)"
    >
      <slot name="item" :option="option" :is-selected="modelValue === option.value">
        <div class="base-option-text">
          <span class="base-option-label">{{ option.label }}</span>
          <span v-if="option.description" class="base-option-description">{{ option.description }}</span>
        </div>
        <span v-if="modelValue === option.value" class="base-option-checkmark">✓</span>
      </slot>
    </button>
  </div>
</template>

<style scoped>
.base-options-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-subtle);
}

.base-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.65rem;
  border: none;
  border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
  background: transparent;
  color: var(--color-text-primary);
  font-size: 0.92rem;
  text-align: start;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  border-radius: 0;
  width: 100%;
  box-sizing: border-box;
}

.base-option-item:last-child {
  border-bottom: none;
}

.base-option-item:not(.disabled):hover:not(.selected) {
  background: rgba(255, 255, 255, 0.05);
}

.base-option-item.selected {
  background: rgba(74, 222, 128, 0.15);
}

.base-option-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.base-option-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.base-option-label {
  flex: 1;
  font-weight: 500;
}

.base-option-description {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.base-option-checkmark {
  color: #4ade80;
  font-size: 1.05rem;
  font-weight: bold;
  margin-left: 0.5rem;
}
</style>
