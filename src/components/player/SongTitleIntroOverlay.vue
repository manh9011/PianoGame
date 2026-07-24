<script setup lang="ts">
import { computed } from 'vue'
import { LEAD_IN_US } from '../../modules/midi/midiPlayerClock'

const INTRO_TOTAL_US = 3_000_000
const INTRO_START_US = -LEAD_IN_US
const INTRO_END_US = INTRO_START_US + INTRO_TOTAL_US
const INTRO_IN_US = 600_000
const INTRO_HOLD_US = 1_500_000
const INTRO_OUT_US = INTRO_TOTAL_US - INTRO_IN_US - INTRO_HOLD_US
const PANEL_MAX_OPACITY = 0.9

const props = defineProps<{
  title: string
  currentUs: number
  started: boolean
  manuallyStopped: boolean
}>()

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

function easeInCubic(progress: number) {
  return progress * progress * progress
}

const normalizedTitle = computed(() => props.title.replace(/\s+/g, ' ').trim())

const visible = computed(() => (
  props.started &&
  !props.manuallyStopped &&
  normalizedTitle.value.length > 0 &&
  props.currentUs >= INTRO_START_US &&
  props.currentUs < INTRO_END_US
))

const elapsedUs = computed(() => Math.max(0, Math.min(INTRO_TOTAL_US, props.currentUs - INTRO_START_US)))

const phase = computed(() => {
  const elapsed = elapsedUs.value
  if (elapsed < INTRO_IN_US) {
    return { name: 'in' as const, progress: clamp01(elapsed / INTRO_IN_US) }
  }
  if (elapsed < INTRO_IN_US + INTRO_HOLD_US) {
    return { name: 'hold' as const, progress: 1 }
  }
  return {
    name: 'out' as const,
    progress: clamp01((elapsed - INTRO_IN_US - INTRO_HOLD_US) / INTRO_OUT_US),
  }
})

const panelOpacity = computed(() => {
  if (phase.value.name === 'in') return lerp(0, PANEL_MAX_OPACITY, easeOutCubic(phase.value.progress))
  if (phase.value.name === 'out') return lerp(PANEL_MAX_OPACITY, 0, easeInCubic(phase.value.progress))
  return PANEL_MAX_OPACITY
})

const titleOpacity = computed(() => {
  if (phase.value.name === 'in') return easeOutCubic(phase.value.progress)
  if (phase.value.name === 'out') return 1 - easeInCubic(phase.value.progress)
  return 1
})

const titleTranslateX = computed(() => {
  if (phase.value.name === 'in') return `${lerp(110, 0, easeOutCubic(phase.value.progress))}vw`
  if (phase.value.name === 'out') return `${lerp(0, -110, easeInCubic(phase.value.progress))}vw`
  return '0vw'
})

const panelStyle = computed(() => ({
  '--intro-panel-alpha': String(panelOpacity.value),
}))

const titleStyle = computed(() => ({
  opacity: titleOpacity.value,
  transform: `translate3d(${titleTranslateX.value}, 0, 0)`,
}))
</script>

<template>
  <div v-if="visible" class="song-title-intro" aria-hidden="true">
    <div class="song-title-intro__panel" :style="panelStyle">
      <div class="song-title-intro__title" :style="titleStyle" dir="auto">
        {{ normalizedTitle }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.song-title-intro {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.song-title-intro__panel {
  position: relative;
  width: 100%;
  min-height: clamp(86px, 16vh, 168px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 1.5rem;
  background: rgba(73, 84, 101, var(--intro-panel-alpha));
  will-change: background-color;
}

.song-title-intro__panel::before,
.song-title-intro__panel::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 10px;
  pointer-events: none;
  opacity: var(--intro-panel-alpha);
}

.song-title-intro__panel::before {
  top: 0;
  background: linear-gradient(to bottom, #9ba6b5 0 5px, #252c36 5px 10px);
}

.song-title-intro__panel::after {
  bottom: 0;
  background: linear-gradient(to bottom, #252c36 0 5px, #9ba6b5 5px 10px);
}

.song-title-intro__title {
  box-sizing: border-box;
  max-width: min(96vw, 1240px);
  padding: 0.16em 0.24em 0.26em;
  overflow: hidden;
  color: #ffffff;
  font-size: clamp(1.2rem, 2.7vw, 2.5rem);
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: 0.018em;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-text-stroke: clamp(1.4px, 0.18vw, 2.5px) #05070a;
  paint-order: stroke fill;
  text-shadow:
    0 2px 2px rgba(0, 0, 0, 0.95),
    0 0 4px rgba(0, 0, 0, 0.9),
    0 0 10px rgba(0, 0, 0, 0.65);
  will-change: opacity, transform;
}

@media (max-width: 700px) {
  .song-title-intro__panel {
    min-height: clamp(72px, 14vh, 120px);
    padding-inline: 1rem;
  }

  .song-title-intro__title {
    font-size: clamp(0.9rem, 4vw, 1.6rem);
  }
}
</style>
