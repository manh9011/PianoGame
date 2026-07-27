<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BasePopover from './BasePopover.vue'
import { useSettingsStore } from '../../../stores/settingsStore'
import { loadRenderAsset, removeRenderAsset, saveRenderAsset } from '../../../modules/storage/renderAssetStore'
import type { RecordVideoOrientation, RecordVideoSize } from '../../../types/settings'

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
const backgroundInputRef = ref<HTMLInputElement | null>(null)
const logoInputRef = ref<HTMLInputElement | null>(null)
const backgroundName = ref('')
const logoName = ref('')
const backgroundPreviewUrl = ref('')
const logoPreviewUrl = ref('')

const sizeOptions: RecordVideoSize[] = ['sd', 'hd', 'fhd', '2k', '4k']
const orientationOptions: RecordVideoOrientation[] = ['landscape', 'portrait']

const hasBackground = computed(() => !!settings.recordBackgroundAssetId)
const hasLogo = computed(() => !!settings.recordLogoAssetId)

function setPreviewUrl(target: 'background' | 'logo', blob?: Blob | null) {
  const previewUrl = target === 'background' ? backgroundPreviewUrl : logoPreviewUrl
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = blob ? URL.createObjectURL(blob) : ''
}

async function syncAssetNames() {
  const background = await loadRenderAsset(settings.recordBackgroundAssetId)
  const logo = await loadRenderAsset(settings.recordLogoAssetId)
  backgroundName.value = background?.name ?? ''
  logoName.value = logo?.name ?? ''
  setPreviewUrl('background', background?.blob)
  setPreviewUrl('logo', logo?.blob)
}

void syncAssetNames()

onBeforeUnmount(() => {
  setPreviewUrl('background', null)
  setPreviewUrl('logo', null)
})

async function handleAssetSelect(event: Event, type: 'background' | 'logo') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const saved = await saveRenderAsset(file, file.name)
  if (type === 'background') {
    if (settings.recordBackgroundAssetId) await removeRenderAsset(settings.recordBackgroundAssetId)
    settings.setRecordBackgroundAssetId(saved.id)
    backgroundName.value = saved.name
    setPreviewUrl('background', saved.blob)
  } else {
    if (settings.recordLogoAssetId) await removeRenderAsset(settings.recordLogoAssetId)
    settings.setRecordLogoAssetId(saved.id)
    logoName.value = saved.name
    setPreviewUrl('logo', saved.blob)
  }
  input.value = ''
}

async function clearAsset(type: 'background' | 'logo') {
  if (type === 'background') {
    await removeRenderAsset(settings.recordBackgroundAssetId)
    settings.setRecordBackgroundAssetId('')
    backgroundName.value = ''
    setPreviewUrl('background', null)
    return
  }
  await removeRenderAsset(settings.recordLogoAssetId)
  settings.setRecordLogoAssetId('')
  logoName.value = ''
  setPreviewUrl('logo', null)
}
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="popupStyle"
    :arrow-style="arrowStyle"
    :arrow-placement="arrowPlacement"
    width="420px"
    @close="emit('close')"
  >
    <div class="record-visual-settings-dialog">
      <div class="setting-block asset-setting-block">
        <div class="asset-preview" :class="{ empty: !backgroundPreviewUrl }">
          <img v-if="backgroundPreviewUrl" :src="backgroundPreviewUrl" alt="" aria-hidden="true" />
          <i v-else class="fas fa-image"></i>
        </div>
        <div class="asset-controls">
          <div class="setting-label-row">
            <span class="setting-label">{{ t('record.backgroundImage') }}</span>
            <button class="mini-btn" type="button" @click="backgroundInputRef?.click()">{{ t('record.chooseImage') }}</button>
          </div>
          <div class="asset-row">
            <span class="asset-name">{{ backgroundName || t('record.noImageSelected') }}</span>
            <button class="mini-btn danger" :disabled="!hasBackground" type="button" @click="clearAsset('background')">{{ t('common.clear') }}</button>
          </div>
        </div>
        <input ref="backgroundInputRef" class="hidden-input" type="file" accept="image/*" @change="handleAssetSelect($event, 'background')" />
      </div>

      <div class="setting-block asset-setting-block">
        <div class="asset-preview" :class="{ empty: !logoPreviewUrl }">
          <img v-if="logoPreviewUrl" :src="logoPreviewUrl" alt="" aria-hidden="true" />
          <i v-else class="fas fa-image"></i>
        </div>
        <div class="asset-controls">
          <div class="setting-label-row">
            <span class="setting-label">{{ t('record.logoImage') }}</span>
            <button class="mini-btn" type="button" @click="logoInputRef?.click()">{{ t('record.chooseImage') }}</button>
          </div>
          <div class="asset-row">
            <span class="asset-name">{{ logoName || t('record.noImageSelected') }}</span>
            <button class="mini-btn danger" :disabled="!hasLogo" type="button" @click="clearAsset('logo')">{{ t('common.clear') }}</button>
          </div>
        </div>
        <input ref="logoInputRef" class="hidden-input" type="file" accept="image/*" @change="handleAssetSelect($event, 'logo')" />
      </div>

      <div class="setting-block">
        <span class="setting-label">{{ t('record.videoSize') }}</span>
        <div class="pill-group">
          <button
            v-for="size in sizeOptions"
            :key="size"
            class="pill-btn"
            :class="{ active: settings.recordVideoSize === size }"
            @click="settings.setRecordVideoSize(size)"
          >
            {{ t(`record.videoSizes.${size}`) }}
          </button>
        </div>
      </div>

      <div class="setting-block">
        <span class="setting-label">{{ t('record.videoOrientation') }}</span>
        <div class="pill-group">
          <button
            v-for="orientation in orientationOptions"
            :key="orientation"
            class="pill-btn"
            :class="{ active: settings.recordVideoOrientation === orientation }"
            @click="settings.setRecordVideoOrientation(orientation)"
          >
            {{ t(`record.orientations.${orientation}`) }}
          </button>
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.record-visual-settings-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-block {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.8rem;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.asset-setting-block {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
}

.asset-preview {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.62);
  flex-shrink: 0;
}

.asset-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-preview.empty {
  font-size: 1.2rem;
}

.asset-controls {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.setting-label-row,
.asset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.setting-label,
.asset-name {
  color: #f3f4f6;
}

.asset-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.74);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.pill-btn,
.mini-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #f3f4f6;
  cursor: pointer;
}

.pill-btn {
  min-height: 2rem;
  padding: 0 0.8rem;
}

.pill-btn.active {
  background: rgba(74, 222, 128, 0.2);
  border-color: rgba(74, 222, 128, 0.44);
  color: #dcfce7;
}

.mini-btn {
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
