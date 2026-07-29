<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
const delayBetweenLoops = ref(50)
const restartLoopAfterErrors = ref(false)
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="540px"
    @close="emit('close')"
  >
    <div class="loop-dialog">
      <div class="header-row">
        <p class="instruction-text">
          {{ t('dialogs.loopInstruction') }}
        </p>
        <button class="clear-button">{{ t('common.clear') }}</button>
      </div>

      <div class="slider-section">
        <span class="slider-label">{{ t('dialogs.delayBetweenLoops') }}</span>
        <input
          v-model.number="delayBetweenLoops"
          type="range"
          min="0"
          max="100"
          step="5"
          class="delay-slider"
        />
      </div>

      <div class="toggle-section">
        <span class="toggle-label">{{ t('dialogs.restartLoopAfterErrors') }}</span>
        <button
          class="toggle-switch"
          :class="{ active: restartLoopAfterErrors }"
          @click="restartLoopAfterErrors = !restartLoopAfterErrors"
        >
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </button>
        <span class="disabled-label">{{ restartLoopAfterErrors ? t('dialogs.enabled') : t('dialogs.disabled') }}</span>
      </div>

      <div class="loop-controls">
        <div class="control-section">
          <button class="nav-button"><i class="fas fa-step-backward"></i></button>
          <span class="section-label">{{ t('dialogs.loopStart') }}</span>
          <button class="nav-button"><i class="fas fa-step-forward"></i></button>
        </div>

        <div class="control-section">
          <button class="nav-button"><i class="fas fa-step-backward"></i></button>
          <span class="section-label">{{ t('dialogs.entireLoop') }}</span>
          <button class="nav-button"><i class="fas fa-step-forward"></i></button>
        </div>

        <div class="control-section">
          <button class="nav-button"><i class="fas fa-step-backward"></i></button>
          <span class="section-label">{{ t('dialogs.loopEnd') }}</span>
          <button class="nav-button"><i class="fas fa-step-forward"></i></button>
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.loop-dialog {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.instruction-text {
  margin: 0;
  flex: 1;
  color: var(--color-text-primary);
  font-size: 0.9rem;
  line-height: 1.4;
}

.clear-button {
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.slider-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider-label {
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
}

.delay-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #5a5c61;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.delay-slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e3e4e8;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.delay-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: #e3e4e8;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.toggle-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toggle-label {
  flex: 1;
  color: var(--color-text-primary);
  font-size: 0.9rem;
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

.disabled-label {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.loop-controls {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.control-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem;
  border-radius: 6px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
}

.nav-button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.nav-button:active {
  transform: scale(0.95);
}

.section-label {
  flex: 1;
  text-align: center;
  color: var(--color-text-primary);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}
</style>

