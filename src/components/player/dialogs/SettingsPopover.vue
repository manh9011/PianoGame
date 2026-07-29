<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BasePopover from '../../ui/BasePopover.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
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
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="280px"
    @close="emit('close')"
  >
    <div class="settings-popover">
      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingNotes') }}</span>
        <BaseToggle :model-value="settings.showFallingNotes" @update:model-value="(v) => { settings.showFallingNotes = v; settings.persist() }" />
      </div>

      <div class="setting-item">
        <span class="setting-label">{{ t('settings.fallingMeasureLines') }}</span>
        <BaseToggle :model-value="settings.showGrid" @update:model-value="(v) => { settings.showGrid = v; settings.persist() }" />
      </div>

      <div class="setting-item">
        <span class="setting-label">{{ t('settings.sheetMusic') }}</span>
        <BaseToggle :model-value="settings.showSheetMusic" @update:model-value="(v) => { settings.showSheetMusic = v; settings.persist() }" />
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.settings-popover {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
}

.setting-label {
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
}


</style>

