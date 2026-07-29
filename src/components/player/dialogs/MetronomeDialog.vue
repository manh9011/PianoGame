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

const volume = computed({
  get: () => settings.metronomeVolume,
  set: value => settings.setMetronomeVolume(value),
})
const doubleSpeed = computed({
  get: () => settings.metronomeDoubleSpeed,
  set: value => settings.setMetronomeDoubleSpeed(value),
})
const emphasizeFirstBeat = computed({
  get: () => settings.metronomeEmphasizeFirstBeat,
  set: value => settings.setMetronomeEmphasizeFirstBeat(value),
})

function getVolumeLabel() {
  return volume.value === 0 ? t('dialogs.off') : `${volume.value}%`
}
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
    <div class="metronome-settings">
      <div class="setting-group">
        <div class="setting-row">
          <label class="setting-label">{{ t('dialogs.metronomeVolume') }}</label>
          <span class="volume-value">{{ getVolumeLabel() }}</span>
        </div>
        <input
          v-model.number="volume"
          type="range"
          min="0"
          max="100"
          step="5"
          class="volume-slider"
        />
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <span class="setting-label">{{ t('settings.doubleSpeed') }}</span>
          <button
            class="toggle-switch"
            :class="{ active: doubleSpeed }"
            @click="doubleSpeed = !doubleSpeed"
          >
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </button>
        </div>

        <div class="setting-row">
          <span class="setting-label">{{ t('settings.emphasizeFirstBeat') }}</span>
          <button
            class="toggle-switch"
            :class="{ active: emphasizeFirstBeat }"
            @click="emphasizeFirstBeat = !emphasizeFirstBeat"
          >
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.metronome-settings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.setting-label {
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 500;
}

.volume-value {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
}

.volume-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #5a5c61;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.volume-slider::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e3e4e8;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.volume-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: #e3e4e8;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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

