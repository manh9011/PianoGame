<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; disabled?: boolean; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; change: [value: boolean] }>()

function toggle() {
  if (props.disabled) return
  const nextValue = !props.modelValue
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
}
</script>

<template>
  <button
    class="settings-toggle"
    type="button"
    :class="{ active: modelValue }"
    :disabled="disabled"
    :aria-pressed="modelValue"
    :aria-label="label"
    @click="toggle"
  >
    <span class="settings-toggle-thumb" />
  </button>
</template>

<style scoped>
.settings-toggle {
  width: 3.25rem;
  height: 1.65rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  padding: 0.12rem;
  background: linear-gradient(#111111, #2f2f2f);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.settings-toggle.active {
  border-color: rgba(118, 220, 119, 0.6);
  background: linear-gradient(#69c769, #3b9a43);
}

.settings-toggle-thumb {
  display: block;
  width: 1.28rem;
  height: 1.28rem;
  border-radius: 50%;
  background: linear-gradient(#ffffff, #d8d8d8);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  transform: translateX(0);
  transition: transform 0.16s ease;
}

.settings-toggle.active .settings-toggle-thumb {
  transform: translateX(1.48rem);
}
</style>
