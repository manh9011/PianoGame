<script setup lang="ts">
import { computed } from 'vue'
import type { SessionNote } from '../../../modules/game/playSession'

const props = defineProps<{
  show: boolean
  selectedNote?: SessionNote | null
  popupStyle?: { top: string; left: string }
  arrowStyle?: { left: string }
}>()

const emit = defineEmits<{
  assignFinger: [hand: 'left' | 'right', finger: number]
  clearFinger: []
  close: []
}>()

const leftFingerButtons = [5, 4, 3, 2, 1]
const rightFingerButtons = [1, 2, 3, 4, 5]
const activeHand = computed<'left' | 'right'>(() => props.selectedNote?.hand === 'left' ? 'left' : 'right')
const fingerButtons = computed(() => activeHand.value === 'left' ? leftFingerButtons : rightFingerButtons)

function selectFinger(finger: number) {
  emit('assignFinger', activeHand.value, finger)
  emit('close')
}

function clearFinger() {
  emit('clearFinger')
  emit('close')
}

function isActive(finger: number) {
  return props.selectedNote?.finger === finger
}
</script>

<template>
  <div v-if="show && selectedNote" class="finger-picker-overlay" @click="emit('close')">
    <div class="finger-picker-dialog" :style="popupStyle" @click.stop>
      <div class="finger-picker-arrow" :style="arrowStyle"></div>

      <div class="finger-picker-shell">
        <button
          v-for="finger in fingerButtons"
          :key="`${activeHand}-${finger}`"
          class="finger-swatch"
          :class="[activeHand, { selected: isActive(finger) }]"
          @click="selectFinger(finger)"
        >
          {{ finger }}
        </button>

        <button class="clear-btn" @click="clearFinger">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.finger-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: transparent;
}

.finger-picker-dialog {
  position: fixed;
  width: 250px;
  background: #2a2a2a;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.42);
  z-index: 1001;
  overflow: visible;
}

.finger-picker-arrow {
  position: absolute;
  top: -7px;
  width: 14px;
  height: 14px;
  background: #3c3c3c;
  border: 1px solid #1a1a1a;
  border-right: none;
  border-bottom: none;
  transform: rotate(45deg);
  z-index: -1;
}

.finger-picker-shell {
  display: flex;
  flex-direction: row;
  gap: 10px;
  padding: 10px;
  background: linear-gradient(180deg, #3c3c3c, #282828);
  border-radius: 8px;
}

.finger-swatch {
  width: 34px;
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
  color: #ffffff;
  font-size: 1rem;
  font-weight: 800;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.finger-swatch.left {
  background: linear-gradient(180deg, #4b8fcb, #2f5f92);
}

.finger-swatch.right {
  background: linear-gradient(180deg, #52b66e, #2e7d45);
}

.finger-swatch:hover,
.clear-btn:hover {
  filter: brightness(1.08);
}

.finger-swatch:active,
.clear-btn:active {
  transform: scale(0.96);
}

.finger-swatch.selected {
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 0 0 2px rgba(251, 191, 36, 0.74),
    0 1px 2px rgba(0, 0, 0, 0.35);
}

.clear-btn {
  width: 40px;
  height: 42px;
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
</style>
