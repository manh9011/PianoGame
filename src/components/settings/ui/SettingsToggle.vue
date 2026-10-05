<script setup lang="ts">
import BaseToggle from '../../ui/BaseToggle.vue'

const props = defineProps<{ modelValue: boolean; disabled?: boolean; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; change: [value: boolean] }>()

function onChange(value: boolean) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <BaseToggle
    :model-value="modelValue"
    :disabled="disabled"
    :label="label"
    @update:model-value="onChange"
  />
</template>
