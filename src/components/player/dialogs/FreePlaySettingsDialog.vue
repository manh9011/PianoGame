<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from './BasePopover.vue'
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

function toggleSetting(key: FreePlaySettingsRowKey) {
  if (key === 'showColorInstrument') freePlay.setShowColorInstrument(!freePlay.showColorInstrument)
  else if (key === 'showRecordedTracks') freePlay.setShowRecordedTracks(!freePlay.showRecordedTracks)
  else freePlay.setShowChordName(!freePlay.showChordName)
}

function toggleKeySignatureMode() {
  freePlay.setKeySignatureMode(isMajorKeySignature.value ? 'minor' : 'major')
}
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="500px"
    @close="emit('close')"
  >
    <div class="free-play-settings">
      <section class="settings-group">
        <div v-for="row in rows" :key="row.key" class="setting-row">
          <span class="setting-label">{{ row.label }}</span>
          <button
            class="toggle-switch"
            :class="{ active: freePlay[row.key] }"
            :aria-pressed="freePlay[row.key]"
            @click="toggleSetting(row.key)"
          >
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </section>

      <section class="settings-group">
        <div class="setting-row key-signature-row">
          <span class="setting-label">{{ t('freePlay.keySignature') }}</span>
          <div class="key-signature-preview">
            <img
              class="key-signature-image"
              :src="selectedKeySignature.src"
              :alt="currentKeyName"
            />
          </div>
          <input
            v-model.number="keySignatureIndex"
            class="key-slider"
            type="range"
            min="0"
            :max="FREE_PLAY_KEY_SIGNATURES.length - 1"
            step="1"
            :aria-label="t('freePlay.keySignature')"
          />
        </div>
        <div class="setting-row">
          <span class="setting-label">{{ t('freePlay.major') }}</span>
          <button
            class="toggle-switch"
            :class="{ active: isMajorKeySignature }"
            :aria-pressed="isMajorKeySignature"
            @click="toggleKeySignatureMode"
          >
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </button>
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

.key-slider {
  flex: 1;
  min-width: 0;
  height: 6px;
  border-radius: 999px;
  background: #9a9a9a;
  outline: none;
  accent-color: #ffffff;
  -webkit-appearance: none;
  appearance: none;
}

.key-slider::-webkit-slider-thumb {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.key-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.current-key {
  color: var(--color-text-primary);
  font-size: 1.25rem;
  text-align: center;
  padding: 0.6rem 0.7rem 0.7rem;
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
</style>

