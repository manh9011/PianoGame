<script setup lang="ts">
import { computed, ref } from 'vue'
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
  audioName?: string
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
  selectAudio: [file: Blob, name: string]
  clearAudio: []
}>()

const { t } = useI18n()
const settings = useSettingsStore()
const audioInputRef = ref<HTMLInputElement | null>(null)

const outputVolume = computed({
  get: () => settings.recordOutputVolume,
  set: value => settings.setRecordOutputVolume(value),
})

function handleAudioSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('selectAudio', file, file.name)
  input.value = ''
}
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

      <div class="setting-item audio-setting-item">
        <div class="setting-label-row">
          <span class="setting-label">{{ t('record.replaceAudio') }}</span>
          <button class="mini-btn" type="button" @click="audioInputRef?.click()">{{ t('record.chooseAudio') }}</button>
        </div>
        <div class="audio-row">
          <span v-if="audioName" class="asset-name">{{ audioName }}</span>
          <span v-else class="asset-name muted">{{ t('record.noAudioSelected') }}</span>
          <button v-if="audioName" class="mini-btn danger" type="button" @click="emit('clearAudio')">{{ t('common.clear') }}</button>
        </div>
        <input ref="audioInputRef" class="hidden-input" type="file" accept=".wav,.mp3,audio/wav,audio/mpeg,audio/mp3" @change="handleAudioSelect" />
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

.audio-setting-item {
  flex-direction: column;
  align-items: stretch;
}

.setting-label-row,
.audio-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.asset-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.74);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.asset-name.muted {
  color: rgba(255, 255, 255, 0.38);
}

.mini-btn {
  border: 1px solid var(--color-border-default);
  border-radius: 999px;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  cursor: pointer;
  min-height: 1.8rem;
  padding: 0 0.65rem;
}

.mini-btn.danger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hidden-input {
  display: none;
}
</style>

