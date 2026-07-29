<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from '../../ui/BasePopover.vue'
import BaseToggle from '../../ui/BaseToggle.vue'
import BaseSlider from '../../ui/BaseSlider.vue'
import { FREE_PLAY_KEY_SIGNATURES, useFreePlayStore } from '../../../stores/freePlayStore'

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
const freePlay = useFreePlayStore()

type FreePlaySettingsRowKey = 'showColorInstrument' | 'showRecordedTracks' | 'showChordName'

const rows = computed<{ key: FreePlaySettingsRowKey; label: string }[]>(() => [
  { key: 'showColorInstrument', label: t('freePlay.colorInstrument') },
  { key: 'showRecordedTracks', label: t('freePlay.recordedTracks') },
  { key: 'showChordName', label: t('freePlay.chordName') },
])

const keySignatureIndex = computed({
  get: () => FREE_PLAY_KEY_SIGNATURES.findIndex(signature => signature.id === freePlay.keySignature),
  set: value => freePlay.setKeySignature(FREE_PLAY_KEY_SIGNATURES[value]?.id ?? 'natural'),
})

const selectedKeySignature = computed(() => FREE_PLAY_KEY_SIGNATURES[keySignatureIndex.value] ?? FREE_PLAY_KEY_SIGNATURES[0])
const selectedKeySignatureNames = computed(() => t(selectedKeySignature.value.nameKey).split('/').map(part => part.trim()))
const isMajorKeySignature = computed(() => freePlay.keySignatureMode === 'major')
const currentKeyName = computed(() => (
  isMajorKeySignature.value
    ? selectedKeySignatureNames.value[0]
    : selectedKeySignatureNames.value[1] ?? selectedKeySignatureNames.value[0]
))

function toggleSetting(key: FreePlaySettingsRowKey, value: boolean) {
  if (key === 'showColorInstrument') freePlay.setShowColorInstrument(value)
  else if (key === 'showRecordedTracks') freePlay.setShowRecordedTracks(value)
  else freePlay.setShowChordName(value)
}
</script>

<template>
  <BasePopover :show="show" :popup-style="popupStyle" :arrow-style="arrowStyle" :arrow-placement="arrowPlacement"
    width="500px" @close="emit('close')">
    <div class="free-play-settings">
      <section class="settings-group">
        <div v-for="row in rows" :key="row.key" class="setting-row">
          <span class="setting-label">{{ row.label }}</span>
          <BaseToggle :model-value="freePlay[row.key]" @update:model-value="(v) => toggleSetting(row.key, v)" />
        </div>
      </section>

      <section class="settings-group">
        <div class="setting-row key-signature-row">
          <span class="setting-label">{{ t('freePlay.keySignature') }}</span>
          <div class="key-signature-preview">
            <img class="key-signature-image" :src="selectedKeySignature.src" :alt="currentKeyName" />
          </div>
          <BaseSlider v-model="keySignatureIndex" :min="0" :max="FREE_PLAY_KEY_SIGNATURES.length - 1" :step="1" />
        </div>
        <div class="setting-row">
          <span class="setting-label">{{ t('freePlay.major') }}</span>
          <BaseToggle :model-value="isMajorKeySignature"
            @update:model-value="(v) => freePlay.setKeySignatureMode(v ? 'major' : 'minor')" />
        </div>
        <div class="current-key">{{ currentKeyName }}</div>
      </section>
    </div>
  </BasePopover>
</template>

<style scoped>
.free-play-settings {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border-radius: 8px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
  overflow: hidden;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  min-height: 44px;
  padding: 0 0.7rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.setting-row:last-child {
  border-bottom: none;
}

.key-signature-row {
  gap: 0.45rem;
}

.key-signature-row .setting-label {
  min-width: 7.7rem;
}


.setting-label {
  min-width: 9.5rem;
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
}

.key-signature-preview {
  width: 5.8rem;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  color: #050505;
  overflow: hidden;
  flex-shrink: 0;
}

.key-signature-image {
  width: 100%;
  height: 34px;
  object-fit: contain;
  object-position: left center;
  filter: invert(1);
}


.current-key {
  color: var(--color-text-primary);
  font-size: 1.25rem;
  text-align: center;
  padding: 0.6rem 0.7rem 0.7rem;
}
</style>
