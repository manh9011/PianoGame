<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from '../../ui/BasePopover.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
import BaseSlider from '../../ui/BaseSlider.vue'
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


</script>

<template>
  <BasePopover :show="show" :popup-style="popupStyle" :arrow-style="arrowStyle" :arrow-placement="arrowPlacement"
    width="420px" @close="emit('close')">
    <div class="free-play-metronome">
      <section class="metronome-controls">
        <BaseSlider v-model="volume" :min="0" :max="100" :step="5" :label="t('dialogs.metronomeVolume')" show-value
          :format-value="(v: number) => v === 0 ? t('dialogs.off') : v + '%'" />

        <div class="setting-row">
          <span class="setting-label">{{ t('settings.doubleSpeed') }}</span>
          <BaseToggle v-model="doubleSpeed" />
        </div>

        <div class="setting-row">
          <span class="setting-label">{{ t('settings.emphasizeFirstBeat') }}</span>
          <BaseToggle v-model="emphasizeFirstBeat" />
        </div>
      </section>

      <section class="signature-grid" :aria-label="t('play.metronome')">
        <button v-for="signature in FREE_PLAY_TIME_SIGNATURES" :key="signature" class="signature-option"
          :class="{ selected: freePlay.timeSignature === signature, disabledOption: signature === 'disabled' }"
          @click="freePlay.setTimeSignature(signature)">
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
