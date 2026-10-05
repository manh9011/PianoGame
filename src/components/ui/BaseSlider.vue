<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  label?: string
  showValue?: boolean
  formatValue?: (value: number) => string
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  showValue: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const displayValue = computed(() => {
  if (props.formatValue) return props.formatValue(props.modelValue)
  return `${props.modelValue}`
})

const percentage = computed(() => {
  const range = props.max - props.min
  if (range <= 0) return 0
  const pct = ((props.modelValue - props.min) / range) * 100
  return Math.min(100, Math.max(0, pct))
})
</script>

<template>
  <div class="base-slider" :class="{ 'has-label': !!label }">
    <div v-if="label || showValue" class="base-slider-header">
      <span v-if="label" class="base-slider-label">{{ label }}</span>
      <span v-if="showValue" class="base-slider-value">{{ displayValue }}</span>
    </div>
    <input
      :value="modelValue"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      class="base-slider-input"
      :style="{ '--slider-pct': `${percentage}%` }"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
  </div>
</template>

<style scoped>
.base-slider {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

.base-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.base-slider-label {
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
}

.base-slider-value {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.base-slider-input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 20px;
  background: transparent;
  outline: none;
  cursor: pointer;
  margin: 0;
  padding: 0;
}

.base-slider-input::-webkit-slider-runnable-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    #8e8e8e 0%,
    #8e8e8e var(--slider-pct, 50%),
    #5a5a5a var(--slider-pct, 50%),
    #5a5a5a 100%
  );
}

.base-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  border: 1.5px solid #222222;
  cursor: pointer;
  margin-top: -5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  transition: transform 0.1s ease;
}

.base-slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.08);
}

.base-slider-input::-moz-range-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    #8e8e8e 0%,
    #8e8e8e var(--slider-pct, 50%),
    #5a5a5a var(--slider-pct, 50%),
    #5a5a5a 100%
  );
}

.base-slider-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: 1.5px solid #222222;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}
</style>
