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

const volume = computed({
  get: () => settings.metronomeVolume,
  set: value => settings.setMetronomeVolume(value),
})
const doubleSpeed = computed({
  get: () => settings.metronomeDoubleSpeed,
  set: value => settings.setMetronomeDoubleSpeed(value),
})
const emphasizeFirstBeat = computed({
  get: () => settings.metronomeEmphasizeFirstBeat,
  set: value => settings.setMetronomeEmphasizeFirstBeat(value),
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
    <div class="metronome-settings">
      <div class="setting-group">
        <BaseSlider v-model="volume" :min="0" :max="100" :step="5" :label="t('dialogs.metronomeVolume')" show-value :format-value="v => v === 0 ? t('dialogs.off') : v + '%'" />
      </div>

      <div class="setting-group">
        <div class="setting-row">
          <span class="setting-label">{{ t('settings.doubleSpeed') }}</span>
          <BaseToggle v-model="doubleSpeed" />
        </div>

        <div class="setting-row">
          <span class="setting-label">{{ t('settings.emphasizeFirstBeat') }}</span>
          <BaseToggle v-model="emphasizeFirstBeat" />
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.metronome-settings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.setting-label {
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 500;
}
</style>

