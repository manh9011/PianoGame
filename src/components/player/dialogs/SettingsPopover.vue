<script setup lang="ts">
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
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="280px"
    @close="emit('close')"
  >
    <div class="settings-popover">
      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingNotes') }}</span>
        <button
          class="toggle-switch"
          :class="{ active: settings.showFallingNotes }"
          @click="settings.showFallingNotes = !settings.showFallingNotes; settings.persist()"
        >
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </button>
      </div>

      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingMeasureLines') }}</span>
        <button
          class="toggle-switch"
          :class="{ active: settings.showGrid }"
          @click="settings.showGrid = !settings.showGrid; settings.persist()"
        >
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </button>
      </div>

      <div class="setting-item">
        <span class="setting-label">{{ t('settings.sheetMusic') }}</span>
        <button
          class="toggle-switch"
          :class="{ active: settings.showSheetMusic }"
          @click="settings.showSheetMusic = !settings.showSheetMusic; settings.persist()"
        >
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </button>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.settings-popover {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
}

.setting-label {
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
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
  background: var(--color-bg-input);
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

