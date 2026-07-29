<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from '../../ui/BasePopover.vue'
import BaseOptionsList, { type BaseOptionItem } from '../../ui/BaseOptionsList.vue'
import { useSettingsStore } from '../../../stores/settingsStore'
import { usePlayerStore } from '../../../stores/playerStore'
import type { KeyboardRangeMode } from '../../../types/settings'

interface Props {
  show: boolean
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right'
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const settings = useSettingsStore()
const player = usePlayerStore()

const options = computed<BaseOptionItem<KeyboardRangeMode>[]>(() => [
  { value: '18-keys', label: t('settings.keyboardRangeOptions.keys18'), disabled: false },
  { value: '25-keys', label: t('settings.keyboardRangeOptions.keys25'), disabled: false },
  { value: '88-keys', label: t('dialogs.all88'), disabled: false },
  { value: 'my-notes', label: t('settings.keyboardRangeOptions.myNotes'), disabled: true },
  { value: 'my-keyboard', label: t('settings.keyboardRangeOptions.myKeyboard'), disabled: true },
  { value: 'song-only', label: t('settings.keyboardRangeOptions.songOnly'), disabled: false },
  { value: 'custom', label: t('settings.keyboardRangeOptions.custom'), disabled: true },
])

function selectOption(value: KeyboardRangeMode) {
  const opt = options.value.find(o => o.value === value)
  if (!opt || opt.disabled) return
  settings.setKeyboardRangeMode(value)
  player.refreshKeyboardRange()
}
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="360px"
    @close="emit('close')"
  >
    <div class="keyboard-range-dialog">
      <p class="instruction-text">
        {{ t('dialogs.keyboardRangeInstruction') }}
      </p>

      <BaseOptionsList
        :options="options"
        :model-value="settings.keyboardRangeMode"
        @update:model-value="selectOption"
      />

      <div class="controls-row">
        <div class="control-group">
          <button class="control-button" disabled>➖</button>
          <button class="control-button" disabled>➕</button>
        </div>
        <div class="control-group">
          <button class="control-button" disabled>◀</button>
          <button class="control-button" disabled>▶</button>
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.keyboard-range-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.instruction-text {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.controls-row {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.control-group {
  display: flex;
  gap: 0.75rem;
}

.control-button {
  width: 60px;
  height: 48px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  color: var(--color-text-primary);
  font-size: 1.3rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-button:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.control-button:not(:disabled):active {
  transform: scale(0.95);
}

.control-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

