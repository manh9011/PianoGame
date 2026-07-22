<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../../stores/playerStore'
import { handSizeInfo } from '../../../modules/fingering/pianoFingering'
import { HAND_SIZE_PRESETS, type HandSizePreset } from '../../../modules/fingering/fingeringTypes'

interface Props {
  show: boolean
  handSize: HandSizePreset
}

const props = defineProps<Props>()
const emit = defineEmits<{
  selectHandSize: [size: HandSizePreset]
  clearAllFingers: []
  autoAssign: []
}>()

const { t } = useI18n()
const player = usePlayerStore()

function sizeDescription(size: HandSizePreset) {
  const info = handSizeInfo(size)
  return t(`fingerDialog.handSizes.${size}`, { span: info.relaxedThumbPinkySpanCm.toFixed(1) })
}
</script>

<template>
  <Transition name="finger-panel">
    <section v-if="show" class="finger-dialog" @click.stop>
      <div class="top-section control-box">
        <p class="hint">{{ t('fingerDialog.pickNoteHint') }}</p>
        <button class="clear-all-button" :disabled="player.fingeringGenerating" @click="emit('clearAllFingers')">
          <i class="fas fa-trash"></i>
          {{ t('fingerDialog.clearAllFingers') }}
        </button>
      </div>

      <div class="assist-section control-box">
        <div class="size-section">
          <div class="hand-size-row">
            <span class="hand-size-icon" aria-hidden="true">
              <i class="fas fa-hand"></i>
            </span>
            <select
              id="finger-hand-size"
              class="hand-size-select"
              :aria-label="t('fingerDialog.handSize')"
              :value="handSize"
              @change="emit('selectHandSize', ($event.target as HTMLSelectElement).value as HandSizePreset)"
            >
            <option v-for="size in HAND_SIZE_PRESETS" :key="size" :value="size">
              {{ size }} — {{ sizeDescription(size) }}
            </option>
            </select>
          </div>
        </div>
        <button class="auto-button" :disabled="player.fingeringGenerating" @click="emit('autoAssign')">
          <i class="fas fa-wand-magic-sparkles"></i>
          {{ t('fingerDialog.autoAssign') }}
        </button>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.finger-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  width: fit-content;
  max-width: calc(100vw - 24px);
  padding: 0;
  color: #e3e4e8;
}
.control-box {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: fit-content;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  background: rgba(16, 17, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.46);
}
.top-section { justify-content: space-between; }
.assist-section { justify-content: flex-end; }
.size-section { display: flex; flex-direction: column; align-items: stretch; gap: 0.25rem; min-width: 220px; }
.hand-size-row { display: flex; align-items: center; gap: 0.55rem; }
.hand-size-icon { display: inline-flex; align-items: center; gap: 0.28rem; color: #e3e4e8; font-size: 0.95rem; text-shadow: 0 1px 2px rgba(0,0,0,0.9); }
.hand-size-select { width: 100%; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(104,108,116,0.92); color: #ffffff; padding: 0.42rem 0.55rem; font-size: 0.82rem; box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 8px rgba(0,0,0,0.36); }
.hint { margin: 0; color: #ffffff; font-size: 0.9rem; font-weight: 600; line-height: 1.3; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.9); }
.auto-button, .clear-all-button { border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #ffffff; padding: 0.48rem 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.9); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 8px rgba(0,0,0,0.42); }
.auto-button { display: flex; align-items: center; justify-content: center; gap: 0.42rem; background: rgba(180, 110, 34, 0.94); border-color: rgba(251, 191, 36, 0.42); }
.clear-all-button { display: flex; align-items: center; justify-content: center; gap: 0.42rem; background: rgba(112, 55, 55, 0.94); border-color: rgba(255,255,255,0.22); }
.auto-button:hover:not(:disabled) { background: rgba(214, 134, 38, 0.98); border-color: rgba(251, 191, 36, 0.64); }
.clear-all-button:hover:not(:disabled) { background: rgba(136, 64, 64, 0.96); border-color: rgba(255,255,255,0.45); }
.auto-button:disabled, .clear-all-button:disabled { opacity: 0.55; cursor: wait; }
.finger-panel-enter-active, .finger-panel-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.finger-panel-enter-from, .finger-panel-leave-to { opacity: 0; transform: translateY(8px); }
@media (max-width: 760px) {
  .finger-dialog { width: calc(100vw - 24px); align-items: stretch; }
  .control-box { width: 100%; flex-wrap: wrap; justify-content: flex-end; }
  .size-section { flex: 1 1 220px; }
}
</style>
