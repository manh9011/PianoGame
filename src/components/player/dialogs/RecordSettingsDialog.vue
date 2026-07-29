<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from '../../ui/BasePopover.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
import BaseSlider from '../../ui/BaseSlider.vue'
import { useSettingsStore } from '../../../stores/settingsStore'

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
const settings = useSettingsStore()

const outputVolume = computed({
  get: () => settings.recordOutputVolume,
  set: value => settings.setRecordOutputVolume(value),
})
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="320px"
    @close="emit('close')"
  >
    <div class="record-settings-dialog">
      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingNotes') }}</span>
        <BaseToggle :model-value="settings.showFallingNotes" @update:model-value="(v) => { settings.showFallingNotes = v; settings.persist() }" />
      </div>

      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingMeasureLines') }}</span>
        <BaseToggle :model-value="settings.showGrid" @update:model-value="(v) => { settings.showGrid = v; settings.persist() }" />
      </div>

      <div class="setting-block">
        <BaseSlider v-model="outputVolume" :min="0" :max="200" :step="1" :label="t('record.outputVolume')" show-value />
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.record-settings-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-item,
.setting-block {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.8rem;
  border-radius: 10px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
}

.setting-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.setting-label {
  color: var(--color-text-primary);
}


</style>

