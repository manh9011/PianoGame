<script setup lang="ts">
import { TRACK_SETTINGS_PALETTE } from '../../../modules/game/trackProperties'

const props = defineProps<{
  show: boolean
  currentColor: string
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right'
}>()

const emit = defineEmits<{
  select: [color: string]
  close: []
}>()

const colors = TRACK_SETTINGS_PALETTE

function selectColor(color: string) {
  emit('select', color)
  emit('close')
}

function close() {
  emit('close')
}
</script>

<template>
  <div v-if="show" class="color-picker-overlay" @click="close">
    <div class="color-picker-dialog" :style="popupStyle" @click.stop>
      <div class="color-picker-arrow" :class="arrowPlacement" :style="arrowStyle"></div>

      <div class="color-picker-shell">
        <button
          v-for="color in colors"
          :key="color"
          class="color-swatch"
          :style="{ backgroundColor: color }"
          :class="{ selected: color === currentColor }"
          @click="selectColor(color)"
        >
          <div v-if="color === currentColor" class="selected-indicator"></div>
        </button>

        <button class="close-btn" @click="close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: transparent;
}

.color-picker-dialog {
  position: fixed;
  width: 80px;
  background: #2a2a2a;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.42);
  z-index: 1001;
  overflow: visible;
}

.color-picker-arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  background: #1f1f1f;
  border: 1px solid #1a1a1a;
  transform: rotate(45deg);
  z-index: -1;
}

.color-picker-arrow.right {
  right: -7px;
  border-left: none;
  border-bottom: none;
}

.color-picker-arrow.left {
  left: -7px;
  border-right: none;
  border-top: none;
}

.color-picker-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: linear-gradient(180deg, #3c3c3c, #282828);
  border-radius: 8px;
}

.color-swatch {
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  position: relative;
  transition: transform 0.15s ease, filter 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.color-swatch:hover {
  filter: brightness(1.08);
}

.color-swatch:active {
  transform: scale(0.96);
}

.color-swatch.selected {
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.selected-indicator {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.close-btn {
  width: 100%;
  height: 40px;
  border: 0;
  border-radius: 4px;
  background: linear-gradient(180deg, #7d7d7d, #5a5a5a);
  color: #ef4444;
  font-size: 1.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.close-btn:hover {
  filter: brightness(1.06);
}
</style>
