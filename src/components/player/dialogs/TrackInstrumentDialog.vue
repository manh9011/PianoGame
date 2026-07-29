<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GM_INSTRUMENT_GROUPS, getInstrumentEmoji } from '../../../modules/audio/gmInstrumentCatalog'

const props = defineProps<{
  show: boolean
  currentProgram: number
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right'
}>()

const emit = defineEmits<{
  select: [program: number]
  close: []
}>()

const activeFamily = ref(GM_INSTRUMENT_GROUPS[0]?.family ?? 'Piano')

watch(() => props.show, show => {
  if (!show) return
  const currentGroup = GM_INSTRUMENT_GROUPS.find(group => group.items.some(item => item.program === props.currentProgram))
  activeFamily.value = currentGroup?.family ?? GM_INSTRUMENT_GROUPS[0]?.family ?? 'Piano'
})

const activeItems = computed(() => GM_INSTRUMENT_GROUPS.find(group => group.family === activeFamily.value)?.items ?? [])

function selectInstrument(program: number) {
  emit('select', program)
  emit('close')
}

function close() {
  emit('close')
}
</script>

<template>
  <div v-if="show" class="instrument-overlay" @click="close">
    <div class="instrument-dialog" :style="popupStyle" @click.stop>
      <div class="dialog-arrow" :class="arrowPlacement" :style="arrowStyle"></div>

      <div class="instrument-content">
        <aside class="family-list">
          <button
            v-for="group in GM_INSTRUMENT_GROUPS"
            :key="group.family"
            class="family-item"
            :class="{ active: group.family === activeFamily }"
            @click="activeFamily = group.family"
          >
            {{ group.family }}
          </button>
        </aside>

        <section class="instrument-list">
          <button
            v-for="instrument in activeItems"
            :key="instrument.program"
            class="instrument-item"
            :class="{ selected: instrument.program === currentProgram }"
            @click="selectInstrument(instrument.program)"
          >
            <span class="instrument-icon">
              <span class="instrument-emoji">{{ getInstrumentEmoji(instrument) }}</span>
            </span>
            <span class="instrument-label">{{ instrument.name }}</span>
            <i v-if="instrument.program === currentProgram" class="fas fa-check selected-check"></i>
          </button>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.instrument-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: transparent;
}

.instrument-dialog {
  position: fixed;
  z-index: 1101;
  width: 500px;
  max-width: calc(100vw - 20px);
  max-height: 520px;
  background: var(--color-bg-elevated-2);
  border: 8px solid #1f1f1f;
  border-radius: 6px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  overflow: visible;
}

.instrument-content {
  display: grid;
  grid-template-columns: 174px 1fr;
  max-height: calc(520px - 16px);
  overflow: hidden;
  border-radius: 2px;
}

.dialog-arrow {
  position: absolute;
  width: 18px;
  height: 18px;
  background: var(--color-bg-elevated-2);
  border: 1px solid rgba(0, 0, 0, 0.35);
  transform: rotate(45deg);
  z-index: 0;
}

.dialog-arrow.right {
  right: -9px;
  border-left: none;
  border-bottom: none;
}

.dialog-arrow.left {
  left: -9px;
  border-right: none;
  border-top: none;
}

.family-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-input);
  border-right: 1px solid #171717;
  overflow-y: auto;
}

.family-item {
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  border-bottom: 1px solid #242424;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  text-align: left;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 0;
}

.family-item:hover,
.family-item.active {
  background: var(--color-bg-elevated);
  color: var(--color-text-inverse);
}

.instrument-list {
  max-height: 520px;
  overflow-y: auto;
  padding: 10px;
  background: var(--color-bg-tertiary);
}

.instrument-item {
  width: 100%;
  min-height: 60px;
  display: grid;
  grid-template-columns: 48px 1fr 24px;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid #1d1d1d;
  border-bottom: 0;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  border-radius: 0;
}

.instrument-item:first-child {
  border-radius: 8px 8px 0 0;
}

.instrument-item:last-child {
  border-bottom: 1px solid #1d1d1d;
  border-radius: 0 0 8px 8px;
}

.instrument-item:hover,
.instrument-item.selected {
  background: #454545;
}

.instrument-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(145deg, #222, #505050);
}

.instrument-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2em;
  height: 1.2em;
  font-family: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;
  font-size: 1.35rem;
  line-height: 1;
  text-align: center;
  transform: translate(-1px, 0);
}

.instrument-item:hover .instrument-emoji,
.instrument-item.selected .instrument-emoji {
  transform: translate(-1px, 0) scale(1.02);
}

.instrument-item.selected .instrument-icon {
  background: linear-gradient(145deg, #2b2b2b, #595959);
}

.instrument-label {
  display: flex;
  align-items: center;
  min-height: 42px;
  font-size: 1rem;
}

.selected-check {
  color: #d3d931;
}

.instrument-icon,
.instrument-label,
.selected-check,
.instrument-emoji {
  pointer-events: none;
}

@media (max-width: 620px) {
  .instrument-content {
    grid-template-columns: 132px 1fr;
  }

  .family-item {
    font-size: 0.8rem;
  }
}
</style>

