<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseInput from '../ui/BaseInput.vue'

interface Props {
  modelValue: string | null
  items: { name: string; total_scores: number }[]
  placeholder: string
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
})

const { t } = useI18n()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'select': [value: string]
}>()

const searchText = ref('')
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
const rootRef = ref<HTMLElement | null>(null)

const filteredItems = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return props.items
  return props.items.filter(item => item.name.toLowerCase().includes(q))
})

function selectItem(name: string) {
  if (props.modelValue === name) {
    emit('update:modelValue', null)
    searchText.value = ''
  } else {
    emit('update:modelValue', name)
    emit('select', name)
    searchText.value = name
  }
  showDropdown.value = false
  highlightedIndex.value = -1
}

function clearSelection() {
  emit('update:modelValue', null)
  searchText.value = ''
  highlightedIndex.value = -1
}

function onFocus() {
  if (props.modelValue) {
    searchText.value = ''
  }
  showDropdown.value = true
}

function onInput() {
  showDropdown.value = true
  highlightedIndex.value = -1
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredItems.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredItems.value.length) {
      selectItem(filteredItems.value[highlightedIndex.value].name)
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
    highlightedIndex.value = -1
  }
}

function handleClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    showDropdown.value = false
    highlightedIndex.value = -1
    if (props.modelValue) {
      searchText.value = props.modelValue
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(() => props.modelValue, (val) => {
  if (val && !showDropdown.value) {
    searchText.value = val
  } else if (!val && !showDropdown.value) {
    searchText.value = ''
  }
})
</script>

<template>
  <div ref="rootRef" class="sc-root" :class="{ disabled }">
    <div class="sc-input-row">
      <BaseInput
        v-model="searchText"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        class="sc-input"
        @focus="onFocus"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button
        v-if="modelValue"
        class="sc-clear"
        type="button"
        :aria-label="t('scoreLibrary.clearFilters')"
        @click="clearSelection"
      >✕</button>
      <span v-if="loading" class="sc-spinner" />
    </div>
    <Transition name="sc-drop">
      <ul v-if="showDropdown && filteredItems.length" class="sc-dropdown" role="listbox">
        <li
          v-for="(item, index) in filteredItems"
          :key="item.name"
          class="sc-item"
          :class="{ highlighted: index === highlightedIndex, selected: modelValue === item.name }"
          role="option"
          :aria-selected="modelValue === item.name"
          @mousedown.prevent="selectItem(item.name)"
        >
          <span class="sc-item-name">{{ item.name }}</span>
          <span class="sc-item-count">{{ item.total_scores }}</span>
        </li>
      </ul>
      <div v-else-if="showDropdown && !loading" class="sc-empty">
        {{ t('scoreLibrary.noResults') }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sc-root {
  position: relative;
  min-width: 0;
  width: 100%;
}

.sc-root.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.sc-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sc-input {
  flex: 1;
}

.sc-clear {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
}

.sc-clear:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.sc-spinner {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-default);
  border-top-color: var(--color-text-secondary);
  border-radius: 50%;
  animation: sc-spin 0.6s linear infinite;
}

@keyframes sc-spin {
  to { transform: rotate(360deg); }
}

.sc-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  list-style: none;
  padding: 4px;
}

.sc-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-primary);
  font-size: 0.88rem;
}

.sc-item:hover,
.sc-item.highlighted {
  background: rgba(255, 255, 255, 0.08);
}

.sc-item.selected {
  background: rgba(255, 255, 255, 0.12);
}

.sc-item-count {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.sc-empty {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin-top: 4px;
  padding: 8px 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-align: center;
}

.sc-drop-enter-active,
.sc-drop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sc-drop-enter-from,
.sc-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
