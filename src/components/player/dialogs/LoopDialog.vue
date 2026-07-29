<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from '../../ui/BasePopover.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
import BaseSlider from '../../ui/BaseSlider.vue'
import BaseButton from '../../ui/BaseButton.vue'

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
        <BaseButton variant="danger" size="sm">{{ t('common.clear') }}</BaseButton>
      </div>

      <BaseSlider v-model="delayBetweenLoops" :min="0" :max="100" :step="5" :label="t('dialogs.delayBetweenLoops')" />

      <div class="toggle-section">
        <span class="toggle-label">{{ t('dialogs.restartLoopAfterErrors') }}</span>
        <BaseToggle v-model="restartLoopAfterErrors" />
        <span class="disabled-label">{{ restartLoopAfterErrors ? t('dialogs.enabled') : t('dialogs.disabled') }}</span>
      </div>

      <div class="loop-controls">
        <div class="control-section">
          <BaseButton variant="icon"><i class="fas fa-step-backward"></i></BaseButton>
          <span class="section-label">{{ t('dialogs.loopStart') }}</span>
          <BaseButton variant="icon"><i class="fas fa-step-forward"></i></BaseButton>
        </div>

        <div class="control-section">
          <BaseButton variant="icon"><i class="fas fa-step-backward"></i></BaseButton>
          <span class="section-label">{{ t('dialogs.entireLoop') }}</span>
          <BaseButton variant="icon"><i class="fas fa-step-forward"></i></BaseButton>
        </div>

        <div class="control-section">
          <BaseButton variant="icon"><i class="fas fa-step-backward"></i></BaseButton>
          <span class="section-label">{{ t('dialogs.loopEnd') }}</span>
          <BaseButton variant="icon"><i class="fas fa-step-forward"></i></BaseButton>
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
.section-label {
  flex: 1;
  text-align: center;
  color: var(--color-text-primary);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}
</style>

