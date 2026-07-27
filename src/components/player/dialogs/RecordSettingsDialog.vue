<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from './BasePopover.vue'
import { useSettingsStore } from '../../../stores/settingsStore'

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

const outputVolume = computed({
  get: () => settings.recordOutputVolume,
  set: value => settings.setRecordOutputVolume(value),
})
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="320px"
    @close="emit('close')"
  >
    <div class="record-settings-dialog">
      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingNotes') }}</span>
        <button class="toggle-switch" :class="{ active: settings.showFallingNotes }" @click="settings.showFallingNotes = !settings.showFallingNotes; settings.persist()">
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </button>
      </div>

      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingMeasureLines') }}</span>
        <button class="toggle-switch" :class="{ active: settings.showGrid }" @click="settings.showGrid = !settings.showGrid; settings.persist()">
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </button>
      </div>

      <div class="setting-block">
        <div class="setting-label-row">
          <span class="setting-label">{{ t('record.outputVolume') }}</span>
          <span class="setting-value">{{ outputVolume }}%</span>
        </div>
        <input
          v-model.number="outputVolume"
          class="slider"
          type="range"
          min="0"
          max="200"
          step="1"
        />
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.record-settings-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-item,
.setting-block {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.8rem;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.setting-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.setting-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.setting-label,
.setting-value {
  color: #f3f4f6;
}

.slider {
  width: 100%;
}

.toggle-switch {
  position: relative;
  width: 50px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.toggle-track {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: #5a5c61;
  transition: background 0.3s ease;
}

.toggle-switch.active .toggle-track {
  background: #4ade80;
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(22px);
}
</style>
