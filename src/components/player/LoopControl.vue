<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'

interface Props {
  show: boolean
}

defineProps<Props>()

const { t } = useI18n()
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
  return restartLoopAfterErrors.value === 0 ? t('dialogs.disabled') : t('dialogs.loopErrorLimitValue', { count: restartLoopAfterErrors.value })
})

const delaySliderStyle = computed(() => ({ '--slider-progress': `${Math.min(100, Math.max(0, delayBetweenLoops.value / 8 * 100))}%` }))
const restartSliderStyle = computed(() => ({ '--slider-progress': `${Math.min(100, Math.max(0, restartLoopAfterErrors.value / 30 * 100))}%` }))

const hasLoopRegion = computed(() => player.loopRegionConfigured)

const canShiftStartBackward = computed(() => {
  if (!loopState.value || !hasLoopRegion.value) return false
  return loopState.value.startUs > 0
})

const canShiftStartForward = computed(() => {
  if (!loopState.value || !session.value || !hasLoopRegion.value) return false
  const nextMeasure = player.findNextMeasure(loopState.value.startUs + 1000)
  return nextMeasure < loopState.value.endUs
})

const canShiftEndBackward = computed(() => {
  if (!loopState.value || !session.value || !hasLoopRegion.value) return false
  const prevMeasure = player.findPrevMeasure(loopState.value.endUs - 1000)
  return prevMeasure > loopState.value.startUs
})

const canShiftEndForward = computed(() => {
  if (!loopState.value || !hasLoopRegion.value) return false
  return loopState.value.endUs < durationUs.value
})

const canShiftEntireBackward = computed(() => {
  if (!loopState.value || !hasLoopRegion.value) return false
  return loopState.value.startUs > 0
})

const canShiftEntireForward = computed(() => {
  if (!loopState.value || !hasLoopRegion.value) return false
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
            <p class="instruction-text">{{ hasLoopRegion ? t('dialogs.loopInstruction') : t('dialogs.loopEmptyInstruction') }}</p>
            <button class="clear-button" @click="clearLoop">{{ t('common.clear') }}</button>
          </div>

          <!-- Row 2: Sliders box -->
          <div class="control-box sliders-box">
            <div class="slider-row">
              <span class="slider-label">{{ t('dialogs.delayBetweenLoops') }}</span>
              <input
                v-model.number="delayBetweenLoops"
                type="range"
                min="0"
                max="8"
                step="0.5"
                class="slider"
                :style="delaySliderStyle"
              />
              <span class="slider-value">{{ delayBetweenLoops }}s</span>
            </div>

            <div class="slider-row">
              <span class="slider-label">{{ t('dialogs.restartLoopAfterErrors') }}</span>
              <input
                v-model.number="restartLoopAfterErrors"
                type="range"
                min="0"
                max="30"
                step="1"
                class="slider"
                :style="restartSliderStyle"
              />
              <span class="slider-value">{{ restartLabel }}</span>
            </div>
          </div>

          <!-- Row 3: Navigation controls -->
          <div class="navigation-row" :class="{ 'navigation-row--disabled': !hasLoopRegion }">
            <div class="nav-group left">
              <button class="nav-btn" :disabled="!canShiftStartBackward" @click="shiftLoopStartBackward">
                <i class="fas fa-step-backward"></i>
              </button>
              <span class="nav-label">{{ t('dialogs.loopStart') }}</span>
              <button class="nav-btn" :disabled="!canShiftStartForward" @click="shiftLoopStartForward">
                <i class="fas fa-step-forward"></i>
              </button>
            </div>

            <div class="nav-group center">
              <button class="nav-btn" :disabled="!canShiftEntireBackward" @click="shiftEntireLoopBackward">
                <i class="fas fa-step-backward"></i>
              </button>
              <span class="nav-label">{{ t('dialogs.entireLoop') }}</span>
              <button class="nav-btn" :disabled="!canShiftEntireForward" @click="shiftEntireLoopForward">
                <i class="fas fa-step-forward"></i>
              </button>
            </div>

            <div class="nav-group right">
              <button class="nav-btn" :disabled="!canShiftEndBackward" @click="shiftLoopEndBackward">
                <i class="fas fa-step-backward"></i>
              </button>
              <span class="nav-label">{{ t('dialogs.loopEnd') }}</span>
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
  background: rgba(16, 17, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.46);
}

.clear-box {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.instruction-text {
  margin: 0;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

.clear-button {
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  background: rgba(104, 108, 116, 0.92);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 3px 8px rgba(0, 0, 0, 0.42);
}

.clear-button:hover {
  background: rgba(128, 132, 140, 0.96);
  border-color: rgba(255, 255, 255, 0.45);
}

.sliders-box {
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
  width: min(720px, calc(100vw - 3rem));
  min-width: 0;
}

.slider-row {
  display: grid;
  grid-template-columns: 210px minmax(280px, 1fr) 78px;
  align-items: center;
  gap: 0.9rem;
}

.slider-label {
  color: #e3e4e8;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  min-width: 0;
}

.slider {
  width: 100%;
  height: 20px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  outline: none;
  box-shadow: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.slider::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgba(122, 126, 134, 0.98) 0%,
    rgba(122, 126, 134, 0.98) var(--slider-progress),
    rgba(255, 255, 255, 0.96) var(--slider-progress),
    rgba(255, 255, 255, 0.96) 100%
  );
  box-shadow: none;
}

.slider::-webkit-slider-thumb {
  width: 22px;
  height: 22px;
  margin-top: -7px;
  border: 2px solid rgba(255, 255, 255, 0.96);
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.58);
}

.slider::-moz-range-track {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgba(122, 126, 134, 0.98) 0%,
    rgba(122, 126, 134, 0.98) var(--slider-progress),
    rgba(255, 255, 255, 0.96) var(--slider-progress),
    rgba(255, 255, 255, 0.96) 100%
  );
  box-shadow: none;
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.96);
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.58);
}

.slider-value {
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  min-width: 60px;
  text-align: right;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
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
  background: rgba(16, 17, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.46);
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
  background: rgba(104, 108, 116, 0.92);
  color: #ffffff;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 3px 8px rgba(0, 0, 0, 0.42);
}

.nav-btn:hover:not(:disabled) {
  background: rgba(128, 132, 140, 0.96);
  border-color: rgba(255, 255, 255, 0.45);
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
