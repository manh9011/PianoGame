<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from './BasePopover.vue'
import { useSettingsStore } from '../../../stores/settingsStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { computeSongRange } from '../../../modules/render/keyboardRange'
import { noteName } from '../../../modules/render/pianoGeometry'
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

interface RangeOption {
  value: KeyboardRangeMode
  labelKey: string
  disabled: boolean
}

const songRange = computed(() => {
  if (!player.session?.notes.length) return null
  return computeSongRange(player.session.notes)
})

const options = computed<RangeOption[]>(() => [
  { value: '18-keys', labelKey: 'settings.keyboardRangeOptions.keys18', disabled: false },
  { value: '25-keys', labelKey: 'settings.keyboardRangeOptions.keys25', disabled: false },
  { value: '88-keys', labelKey: 'dialogs.all88', disabled: false },
  { value: 'my-notes', labelKey: 'settings.keyboardRangeOptions.myNotes', disabled: true },
  { value: 'my-keyboard', labelKey: 'settings.keyboardRangeOptions.myKeyboard', disabled: true },
  { value: 'song-only', labelKey: 'settings.keyboardRangeOptions.songOnly', disabled: false },
  { value: 'custom', labelKey: 'settings.keyboardRangeOptions.custom', disabled: true },
])

function selectOption(option: RangeOption) {
  if (option.disabled) return
  settings.setKeyboardRangeMode(option.value)
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

      <div class="options-list">
        <button
          v-for="option in options"
          :key="option.value"
          class="option-item"
          :class="{
            selected: settings.keyboardRangeMode === option.value,
            disabled: option.disabled
          }"
          :disabled="option.disabled"
          @click="selectOption(option)"
        >
          <div class="option-content">
            <span class="option-label">{{ t(option.labelKey) }}</span>
          </div>
          <span v-if="settings.keyboardRangeMode === option.value" class="checkmark">✓</span>
        </button>
      </div>

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
  color: #9ca3af;
  font-size: 0.9rem;
  line-height: 1.5;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.5rem;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
  color: #e3e4e8;
  font-size: 1rem;
  text-align: start;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 0;
}

.option-item:last-child {
  border-bottom: none;
}

.option-item:not(.disabled):hover {
  background: rgba(255, 255, 255, 0.05);
}

.option-item.selected {
  background: rgba(74, 222, 128, 0.15);
}

.option-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.option-label {
  flex: 1;
}

.option-description {
  font-size: 0.8rem;
  color: #9ca3af;
}

.checkmark {
  color: #4ade80;
  font-size: 1.2rem;
  font-weight: bold;
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
  color: #e3e4e8;
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
