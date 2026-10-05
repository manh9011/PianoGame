<script setup lang="ts">
interface Tab {
  id: string
  label: string
  disabled?: boolean
}

interface Props {
  tabs: Tab[]
  modelValue: string
}

defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function select(tabId: string) {
  emit('update:modelValue', tabId)
}
</script>

<template>
  <nav class="base-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="base-tab"
      :class="{ active: modelValue === tab.id }"
      :disabled="tab.disabled"
      role="tab"
      :aria-selected="modelValue === tab.id"
      @click="select(tab.id)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.base-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.base-tab {
  flex: 1;
  padding: 0.42rem 0.85rem;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
  white-space: nowrap;
}

.base-tab:hover:not(:disabled):not(.active) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary);
}

.base-tab.active {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.base-tab:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
