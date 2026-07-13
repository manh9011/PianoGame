<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../../stores/playerStore'

interface Props {
  show: boolean
}

defineProps<Props>()

const player = usePlayerStore()
const session = computed(() => player.session)
const loopState = computed(() => session.value?.loopState)
const durationUs = computed(() => player.clock?.seekableDurationUs ?? 0)

const delayBetweenLoops = computed({
  get: () => loopState.value?.delayBetweenLoops ?? 0,
  set: (v: number) => player.setLoopDelay(v),
})

const restartLoopAfterErrors = computed({
  get: () => loopState.value?.restartAfterErrors ?? 0,
  set: (v: number) => player.setLoopRestartAfterErrors(v),
})

const restartLabel = computed(() => {
  return restartLoopAfterErrors.value === 0 ? 'Disabled' : `${restartLoopAfterErrors.value}s`
})

const canShiftStartBackward = computed(() => {
  if (!loopState.value) return false
  return loopState.value.startUs > 0
})

const canShiftStartForward = computed(() => {
  if (!loopState.value || !session.value) return false
  const nextMeasure = player.findNextMeasure(loopState.value.startUs + 1000)
  return nextMeasure < loopState.value.endUs
})

const canShiftEndBackward = computed(() => {
  if (!loopState.value || !session.value) return false
  const prevMeasure = player.findPrevMeasure(loopState.value.endUs - 1000)
  return prevMeasure > loopState.value.startUs
})

const canShiftEndForward = computed(() => {
  if (!loopState.value) return false
  return loopState.value.endUs < durationUs.value
})

const canShiftEntireBackward = computed(() => {
  if (!loopState.value) return false
  return loopState.value.startUs > 0
})

const canShiftEntireForward = computed(() => {
  if (!loopState.value) return false
  return loopState.value.endUs < durationUs.value
})

function shiftLoopStartBackward() {
  if (canShiftStartBackward.value) player.shiftLoopStart(-1)
}

function shiftLoopStartForward() {
  if (canShiftStartForward.value) player.shiftLoopStart(1)
}

function shiftLoopEndBackward() {
  if (canShiftEndBackward.value) player.shiftLoopEnd(-1)
}

function shiftLoopEndForward() {
  if (canShiftEndForward.value) player.shiftLoopEnd(1)
}

function shiftEntireLoopBackward() {
  if (canShiftEntireBackward.value) player.shiftEntireLoop(-1)
}

function shiftEntireLoopForward() {
  if (canShiftEntireForward.value) player.shiftEntireLoop(1)
}

function clearLoop() {
  player.clearLoopRegion()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="loop-fade">
      <div v-if="show" class="loop-overlay">
        <div class="loop-bar" @click.stop>
          <!-- Row 1: Clear box -->
          <div class="control-box clear-box">
            <p class="instruction-text">Drag in the timeline to create a loop. Fine-tune below.</p>
            <button class="clear-button" @click="clearLoop">Clear</button>
          </div>

          <!-- Row 2: Sliders box -->
          <div class="control-box sliders-box">
            <div class="slider-row">
              <span class="slider-label">Delay between loops</span>
              <input
                v-model.number="delayBetweenLoops"
                type="range"
                min="0"
                max="8"
                step="0.5"
                class="slider"
              />
              <span class="slider-value">{{ delayBetweenLoops }}s</span>
            </div>

            <div class="slider-row">
              <span class="slider-label">Restart Loop After Errors</span>
              <input
                v-model.number="restartLoopAfterErrors"
                type="range"
                min="0"
                max="30"
                step="1"
                class="slider"
              />
              <span class="slider-value">{{ restartLabel }}</span>
            </div>
          </div>

          <!-- Row 3: Navigation controls -->
          <div class="navigation-row">
            <div class="nav-group left">
              <button class="nav-btn" :disabled="!canShiftStartBackward" @click="shiftLoopStartBackward">
                <i class="fas fa-step-backward"></i>
              </button>
              <span class="nav-label">Loop Start</span>
              <button class="nav-btn" :disabled="!canShiftStartForward" @click="shiftLoopStartForward">
                <i class="fas fa-step-forward"></i>
              </button>
            </div>

            <div class="nav-group center">
              <button class="nav-btn" :disabled="!canShiftEntireBackward" @click="shiftEntireLoopBackward">
                <i class="fas fa-step-backward"></i>
              </button>
              <span class="nav-label">Entire Loop</span>
              <button class="nav-btn" :disabled="!canShiftEntireForward" @click="shiftEntireLoopForward">
                <i class="fas fa-step-forward"></i>
              </button>
            </div>

            <div class="nav-group right">
              <button class="nav-btn" :disabled="!canShiftEndBackward" @click="shiftLoopEndBackward">
                <i class="fas fa-step-backward"></i>
              </button>
              <span class="nav-label">Loop End</span>
              <button class="nav-btn" :disabled="!canShiftEndForward" @click="shiftLoopEndForward">
                <i class="fas fa-step-forward"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.loop-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
}

.loop-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
  pointer-events: auto;
  align-items: center;
}

.control-box {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  background: rgba(43, 45, 49, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.clear-box {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.instruction-text {
  margin: 0;
  color: #e3e4e8;
  font-size: 0.9rem;
  line-height: 1.3;
  white-space: nowrap;
}

.clear-button {
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  background: rgba(60, 62, 66, 0.8);
  color: #e3e4e8;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.clear-button:hover {
  background: rgba(80, 82, 86, 0.9);
  border-color: rgba(255, 255, 255, 0.35);
}

.sliders-box {
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
  min-width: 400px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-label {
  color: #e3e4e8;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  min-width: 160px;
}

.slider {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: #5a5c61;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e3e4e8;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: #e3e4e8;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.slider-value {
  color: #9ca3af;
  font-size: 0.85rem;
  min-width: 60px;
  text-align: right;
}

.navigation-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  background: rgba(43, 45, 49, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.nav-group.left {
  justify-self: start;
}

.nav-group.center {
  justify-self: center;
}

.nav-group.right {
  justify-self: end;
}

.nav-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(60, 62, 66, 0.8);
  color: #e3e4e8;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(80, 82, 86, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
}

.nav-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-label {
  color: #e3e4e8;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0 0.5rem;
}

.loop-fade-enter-active,
.loop-fade-leave-active {
  transition: opacity 0.2s ease;
}

.loop-fade-enter-from,
.loop-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1200px) {
  .sliders-box {
    min-width: 350px;
  }
}

@media (max-width: 768px) {
  .loop-bar {
    padding: 0.75rem 1rem 1rem;
  }

  .navigation-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .nav-group {
    width: 100%;
    justify-content: center;
  }

  .sliders-box {
    min-width: 300px;
  }

  .slider-label {
    min-width: 120px;
    font-size: 0.8rem;
  }
}
</style>
