<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LabelMode } from '../../../types/settings'
import { useSettingsStore } from '../../../stores/settingsStore'
import BasePopover from '../../ui/BasePopover.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
import BaseSlider from '../../ui/BaseSlider.vue'
import BaseTabs from '../../ui/BaseTabs.vue'
import BaseOptionsList, { type BaseOptionItem } from '../../ui/BaseOptionsList.vue'

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
const activeTab = ref('key')
const settings = useSettingsStore()

const tabOptions = computed(() => [
  { id: 'key', label: t('labelsDialog.keyLabels') },
  { id: 'note', label: t('labelsDialog.noteLabels') }
])

type LabelOptionValue = LabelMode | 'none'

const keyLabelOptions = computed<BaseOptionItem<LabelOptionValue>[]>(() => [
  { value: 'none', label: t('labelsDialog.noLabels') },
  { value: 'octaves', label: t('labelsDialog.options.octaves') },
  { value: 'finger-hint', label: t('labelsDialog.options.fingerHint') },
  { value: 'virtual-piano', label: t('labelsDialog.options.virtualPiano') },
  { value: 'english', label: t('labelsDialog.options.english') },
  { value: 'fixed-do', label: t('labelsDialog.options.fixedDo') },
  { value: 'movable-do', label: t('labelsDialog.options.movableDo') },
  { value: 'scale-number', label: t('labelsDialog.options.scaleNumber') },
  { value: 'simple', label: t('labelsDialog.options.simple') },
])

const noteLabelOptions = keyLabelOptions

const selectedKeyLabel = computed<LabelOptionValue>(() => settings.showKeyLabels ? settings.keyLabelMode : 'none')

const selectedNoteLabel = computed<LabelOptionValue>(() => settings.showNoteLabels ? settings.noteLabelMode : 'none')

function selectKeyLabel(value: LabelOptionValue) {
  if (value === 'none') {
    settings.setShowKeyLabels(false)
    return
  }

  settings.setKeyLabelMode(value)
}

function selectNoteLabel(value: LabelOptionValue) {
  if (value === 'none') {
    settings.setShowNoteLabels(false)
    return
  }

  settings.setNoteLabelMode(value)
}
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="430px"
    @close="emit('close')"
  >
    <div class="labels-dialog">
      <BaseTabs :tabs="tabOptions" v-model="activeTab" />

      <div v-if="activeTab === 'key'" class="tab-content">
        <BaseOptionsList
          :options="keyLabelOptions"
          :model-value="selectedKeyLabel"
          @update:model-value="selectKeyLabel"
        />

        <div class="slider-row">
          <BaseSlider :model-value="settings.keyLabelSize" @update:model-value="(v: number) => settings.setKeyLabelSize(v)" :min="-10" :max="25" :step="1" :label="t('labelsDialog.labelSize')" show-value :format-value="(v: number) => v > 0 ? '+' + v : String(v)" />
        </div>
      </div>

      <div v-else class="tab-content">
        <BaseOptionsList
          :options="noteLabelOptions"
          :model-value="selectedNoteLabel"
          @update:model-value="selectNoteLabel"
        />

        <div class="toggles-grid">
          <div class="toggle-row compact">
            <span class="toggle-label">{{ t('labelsDialog.showFingerHints') }}</span>
            <BaseToggle :model-value="settings.showFingerHints" @update:model-value="(v) => settings.setShowFingerHints(v)" />
          </div>

          <div class="toggle-row compact">
            <span class="toggle-label">{{ t('settings.coloredFingerHints') }}</span>
            <BaseToggle :model-value="settings.showColoredFingerHints" @update:model-value="(v) => settings.setShowColoredFingerHints(v)" />
          </div>
        </div>

        <div class="slider-row">
          <BaseSlider :model-value="settings.noteLabelSize" @update:model-value="(v: number) => settings.setNoteLabelSize(v)" :min="-10" :max="25" :step="1" :label="t('labelsDialog.labelSize')" show-value :format-value="(v: number) => v > 0 ? '+' + v : String(v)" />
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.labels-dialog { display: flex; flex-direction: column; gap: 0.42rem; }
.tab-content { display: flex; flex-direction: column; gap: 0.42rem; }
.toggles-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.42rem; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: 8px; background: var(--color-bg-subtle); border: 1px solid var(--color-border-default); }
.toggle-row.compact { min-width: 0; }
.toggle-label { color: var(--color-text-primary); font-size: 0.88rem; font-weight: 500; line-height: 1.25; }
.slider-row { display: flex; flex-direction: column; gap: 0.55rem; padding: 0.6rem 0.75rem; border-radius: 8px; background: var(--color-bg-subtle); border: 1px solid var(--color-border-default); }
@media (max-width: 520px) {
  .toggles-grid { grid-template-columns: 1fr; }
}
</style>

