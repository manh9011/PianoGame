<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from './BasePopover.vue'
import { FREE_PLAY_TIME_SIGNATURES, useFreePlayStore, type FreePlayTimeSignature } from '../../../stores/freePlayStore'

interface Props {
  show: boolean
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top?: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right' | 'top'
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const freePlay = useFreePlayStore()

const volume = computed({
  get: () => freePlay.metronomeVolume,
  set: value => freePlay.setMetronomeVolume(value),
})
const doubleSpeed = computed({
  get: () => freePlay.metronomeDoubleSpeed,
  set: value => freePlay.setMetronomeDoubleSpeed(value),
})
const emphasizeFirstBeat = computed({
  get: () => freePlay.metronomeEmphasizeFirstBeat,
  set: value => freePlay.setMetronomeEmphasizeFirstBeat(value),
})

function fractionParts(signature: FreePlayTimeSignature) {
  if (signature === 'disabled') return null
  const [top, bottom] = signature.split('/')
  return { top, bottom }
}

function volumeLabel() {
  return volume.value === 0 ? t('dialogs.off') : `${volume.value}%`
}
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="420px"
    @close="emit('close')"
  >
    <div class="free-play-metronome">
      <section class="metronome-controls">
        <div class="setting-row volume-row">
          <label class="setting-label">{{ t('dialogs.metronomeVolume') }}</label>
          <span class="volume-value">{{ volumeLabel() }}</span>
        </div>
        <input
          v-model.number="volume"
          type="range"
          min="0"
          max="100"
          step="5"
          class="volume-slider"
        />

        <div class="setting-row">
          <span class="setting-label">{{ t('settings.doubleSpeed') }}</span>
          <button class="toggle-switch" :class="{ active: doubleSpeed }" @click="doubleSpeed = !doubleSpeed">
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </button>
        </div>

        <div class="setting-row">
          <span class="setting-label">{{ t('settings.emphasizeFirstBeat') }}</span>
          <button class="toggle-switch" :class="{ active: emphasizeFirstBeat }" @click="emphasizeFirstBeat = !emphasizeFirstBeat">
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </section>

      <section class="signature-grid" :aria-label="t('play.metronome')">
        <button
          v-for="signature in FREE_PLAY_TIME_SIGNATURES"
          :key="signature"
          class="signature-option"
          :class="{ selected: freePlay.timeSignature === signature, disabledOption: signature === 'disabled' }"
          @click="freePlay.setTimeSignature(signature)"
        >
          <span v-if="signature === 'disabled'" class="disabled-label">{{ t('dialogs.disabled') }}</span>
          <span v-else class="fraction-label" aria-hidden="true">
            <span class="fraction-top">{{ fractionParts(signature)?.top }}</span>
            <span class="fraction-bottom">{{ fractionParts(signature)?.bottom }}</span>
          </span>
          <span class="sr-only">{{ signature === 'disabled' ? t('dialogs.disabled') : signature }}</span>
        </button>
      </section>
    </div>
  </BasePopover>
</template>

<style scoped>
.free-play-metronome {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.metronome-controls {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.setting-label {
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
}

.volume-value {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
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

.signature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
  max-height: 320px;
  overflow-y: auto;
}

.signature-option {
  min-height: 74px;
  padding: 0.35rem;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.signature-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.signature-option.selected {
  color: #facc15;
  border-color: rgba(250, 204, 21, 0.55);
  background: rgba(250, 204, 21, 0.12);
}

.disabledOption {
  font-size: 0.85rem;
  font-weight: 700;
}

.disabled-label {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fraction-label {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 0.9;
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 900;
  font-size: 1.95rem;
}

.fraction-top,
.fraction-bottom {
  display: block;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

