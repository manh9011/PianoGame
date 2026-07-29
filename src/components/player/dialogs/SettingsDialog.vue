<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'

interface Props {
  show: boolean
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  popupStyle: () => ({ top: '0px', left: '0px' }),
  arrowStyle: () => ({ top: '0px', right: '-7px' }),
  arrowPlacement: 'right'
})

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const settings = useSettingsStore()

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.settings-dialog-container')) return
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-dialog">
      <div v-if="show" class="settings-dialog-wrapper" @click="handleClickOutside">
        <div
          class="settings-dialog-container"
          :style="popupStyle"
          @click.stop
        >
          <div class="settings-dialog-content">
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
          <div
            class="settings-dialog-arrow"
            :class="arrowPlacement"
            :style="arrowStyle"
          ></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-dialog-wrapper {
  position: fixed;
  inset: 0;
  z-index: 100;
}

.settings-dialog-container {
  position: absolute;
  display: flex;
  flex-direction: column;
  width: 280px;
  border-radius: 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-lg);
  overflow: visible;
  z-index: 100;
}

.settings-dialog-content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
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

.settings-dialog-arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  transform: rotate(45deg);
  pointer-events: none;
}

.settings-dialog-arrow.right {
  border-left: none;
  border-bottom: none;
}

.settings-dialog-arrow.left {
  border-right: none;
  border-bottom: none;
}

.settings-dialog-enter-active,
.settings-dialog-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.settings-dialog-enter-from,
.settings-dialog-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style>

