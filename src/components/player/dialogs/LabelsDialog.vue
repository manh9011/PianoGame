<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LabelMode } from '../../../types/settings'
import { useSettingsStore } from '../../../stores/settingsStore'
import BasePopover from './BasePopover.vue'

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
const activeTab = ref<'key' | 'note'>('key')
const settings = useSettingsStore()

type LabelOptionValue = LabelMode | 'none'

const keyLabelOptions: { value: LabelOptionValue; labelKey: string }[] = [
  { value: 'none', labelKey: 'labelsDialog.noLabels' },
  { value: 'octaves', labelKey: 'labelsDialog.options.octaves' },
  { value: 'finger-hint', labelKey: 'labelsDialog.options.fingerHint' },
  { value: 'virtual-piano', labelKey: 'labelsDialog.options.virtualPiano' },
  { value: 'english', labelKey: 'labelsDialog.options.english' },
  { value: 'fixed-do', labelKey: 'labelsDialog.options.fixedDo' },
  { value: 'movable-do', labelKey: 'labelsDialog.options.movableDo' },
  { value: 'scale-number', labelKey: 'labelsDialog.options.scaleNumber' },
  { value: 'simple', labelKey: 'labelsDialog.options.simple' },
]

const noteLabelOptions = keyLabelOptions

const selectedKeyLabel = computed<LabelOptionValue>(() => settings.showKeyLabels ? settings.keyLabelMode : 'none')

const selectedNoteLabel = computed<LabelOptionValue>(() => settings.showNoteLabels ? settings.noteLabelMode : 'none')

function selectKeyLabel(value: LabelOptionValue) {
  if (value === 'none') {
    settings.setShowKeyLabels(false)
    return
  }

  settings.setKeyLabelMode(value)
}

function selectNoteLabel(value: LabelOptionValue) {
  if (value === 'none') {
    settings.setShowNoteLabels(false)
    return
  }

  settings.setNoteLabelMode(value)
}
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="430px"
    @close="emit('close')"
  >
    <div class="labels-dialog">
      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'key' }"
          @click="activeTab = 'key'"
        >
          {{ t('labelsDialog.keyLabels') }}
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'note' }"
          @click="activeTab = 'note'"
        >
          {{ t('labelsDialog.noteLabels') }}
        </button>
      </div>

      <div v-if="activeTab === 'key'" class="tab-content">
        <div class="options-list">
          <button
            v-for="option in keyLabelOptions"
            :key="option.value"
            class="option-item"
            :class="{ selected: selectedKeyLabel === option.value }"
            @click="selectKeyLabel(option.value)"
          >
            <span class="option-label">{{ t(option.labelKey) }}</span>
            <span v-if="selectedKeyLabel === option.value" class="checkmark">✓</span>
          </button>
        </div>

        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-label">{{ t('labelsDialog.labelSize') }}</span>
            <span class="slider-value">{{ settings.keyLabelSize > 0 ? '+' : '' }}{{ settings.keyLabelSize }}</span>
          </div>
          <input
            :value="settings.keyLabelSize"
            @input="settings.setKeyLabelSize(Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="-10"
            max="25"
            step="1"
            class="size-slider"
          />
        </div>
      </div>

      <div v-else class="tab-content">
        <div class="options-list">
          <button
            v-for="option in noteLabelOptions"
            :key="option.value"
            class="option-item"
            :class="{ selected: selectedNoteLabel === option.value }"
            @click="selectNoteLabel(option.value)"
          >
            <span class="option-label">{{ t(option.labelKey) }}</span>
            <span v-if="selectedNoteLabel === option.value" class="checkmark">✓</span>
          </button>
        </div>

        <div class="toggles-grid">
          <div class="toggle-row compact">
            <span class="toggle-label">{{ t('labelsDialog.showFingerHints') }}</span>
            <button
              class="toggle-switch"
              :class="{ active: settings.showFingerHints }"
              @click="settings.setShowFingerHints(!settings.showFingerHints)"
            >
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <div class="toggle-row compact">
            <span class="toggle-label">{{ t('settings.coloredFingerHints') }}</span>
            <button
              class="toggle-switch"
              :class="{ active: settings.showColoredFingerHints }"
              @click="settings.setShowColoredFingerHints(!settings.showColoredFingerHints)"
            >
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-label">{{ t('labelsDialog.labelSize') }}</span>
            <span class="slider-value">{{ settings.noteLabelSize > 0 ? '+' : '' }}{{ settings.noteLabelSize }}</span>
          </div>
          <input
            :value="settings.noteLabelSize"
            @input="settings.setNoteLabelSize(Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="-10"
            max="25"
            step="1"
            class="size-slider"
          />
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.labels-dialog { display: flex; flex-direction: column; gap: 0.42rem; }
.tabs { display: flex; gap: 0; border-radius: 8px; overflow: hidden; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); }
.tab { flex: 1; padding: 0.58rem 0.9rem; border: none; background: transparent; color: #9ca3af; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease; border-radius: 0; }
.tab.active { background: rgba(74, 222, 128, 0.15); color: #e3e4e8; }
.tab-content { display: flex; flex-direction: column; gap: 0.42rem; }
.options-list { display: flex; flex-direction: column; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); }
.option-item { display: flex; align-items: center; justify-content: space-between; padding: 0.42rem 0.5rem; border: none; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(0, 0, 0, 0.2); color: #e3e4e8; font-size: 0.92rem; text-align: start; cursor: pointer; transition: all 0.2s ease; border-radius: 0; }
.option-item:last-child { border-bottom: none; }
.option-item:hover { background: rgba(255, 255, 255, 0.05); }
.option-item.selected { background: rgba(74, 222, 128, 0.15); }
.option-label { flex: 1; }
.checkmark { color: #4ade80; font-size: 1.05rem; font-weight: bold; }
.toggles-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.42rem; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: 8px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); }
.toggle-row.compact { min-width: 0; }
.toggle-label { color: #e3e4e8; font-size: 0.88rem; font-weight: 500; line-height: 1.25; }
.toggle-switch { position: relative; width: 50px; height: 28px; padding: 0; border: none; border-radius: 14px; background: transparent; cursor: pointer; flex-shrink: 0; transition: all 0.3s ease; }
.toggle-track { position: absolute; inset: 0; border-radius: 14px; background: #5a5c61; transition: background 0.3s ease; }
.toggle-switch.active .toggle-track { background: #4ade80; }
.toggle-thumb { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); transition: transform 0.3s ease; }
.toggle-switch.active .toggle-thumb { transform: translateX(22px); }
.slider-row { display: flex; flex-direction: column; gap: 0.55rem; padding: 0.6rem 0.75rem; border-radius: 8px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); }
.slider-header { display: flex; align-items: center; justify-content: space-between; }
.slider-label { color: #e3e4e8; font-size: 0.9rem; font-weight: 500; }
.slider-value { color: #9ca3af; font-size: 0.86rem; }
.size-slider { width: 100%; height: 6px; border-radius: 3px; background: #5a5c61; outline: none; -webkit-appearance: none; appearance: none; }
.size-slider::-webkit-slider-thumb { width: 18px; height: 18px; border-radius: 50%; background: #e3e4e8; cursor: pointer; -webkit-appearance: none; appearance: none; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); }
.size-slider::-moz-range-thumb { width: 18px; height: 18px; border: none; border-radius: 50%; background: #e3e4e8; cursor: pointer; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); }
@media (max-width: 520px) {
  .toggles-grid { grid-template-columns: 1fr; }
}
</style>
