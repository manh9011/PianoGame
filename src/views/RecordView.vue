<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlayerStore } from '../stores/playerStore'
import { useRecordStore, type RecordExportPreset } from '../stores/recordStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import RecordTopBar from '../components/player/RecordTopBar.vue'
import TrackProgressBar from '../components/player/TrackProgressBar.vue'
import RecordStageCanvas from '../components/player/RecordStageCanvas.vue'
import RecordSettingsDialog from '../components/player/dialogs/RecordSettingsDialog.vue'
import RecordVisualSettingsDialog from '../components/player/dialogs/RecordVisualSettingsDialog.vue'
import TrackConfigDialog from '../components/player/dialogs/TrackConfigDialog.vue'
import KeyboardRangeDialog from '../components/player/dialogs/KeyboardRangeDialog.vue'
import LabelsDialog from '../components/player/dialogs/LabelsDialog.vue'
import { createRecordRenderScene, type RecordRenderVisualOptions } from '../modules/render/record/recordRenderModel'
import { playRenderCompleteSound } from '../modules/audio/notificationSound'
import { renderExportJob } from '../modules/renderExport/renderExportClient'
import type { RenderExportProgressMessage } from '../modules/renderExport/exportTypes'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const library = useLibraryStore()
const player = usePlayerStore()
const record = useRecordStore()
const settings = useSettingsStore()
const toast = useToastStore()

const showSettingsDialog = ref(false)
const showVisualSettingsDialog = ref(false)
const showTrackConfigDialog = ref(false)
const showKeyboardRangeDialog = ref(false)
const showLabelsDialog = ref(false)
const showRenderMenu = ref(false)

const settingsPopupStyle = ref({ top: '0px', left: '0px' })
const settingsArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const settingsArrowPlacement = ref<'left' | 'right'>('right')
const visualSettingsPopupStyle = ref({ top: '0px', left: '0px' })
const visualSettingsArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const visualSettingsArrowPlacement = ref<'left' | 'right'>('right')
const trackConfigPopupStyle = ref({ top: '0px', left: '0px' })
const trackConfigArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const trackConfigArrowPlacement = ref<'left' | 'right'>('right')
const keyboardRangePopupStyle = ref({ top: '0px', left: '0px' })
const keyboardRangeArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const keyboardRangeArrowPlacement = ref<'left' | 'right'>('right')
const labelsPopupStyle = ref({ top: '0px', left: '0px' })
const labelsArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const labelsArrowPlacement = ref<'left' | 'right'>('right')

const headerTitle = computed(() => player.song?.title ?? t('record.title'))
const showExportStatus = computed(() => record.exporting || record.exportProgress.stage === 'done' || !!record.lastExportError)
const exportVisuals = computed<RecordRenderVisualOptions>(() => ({
  showGrid: settings.showGrid,
  showFallingNotes: settings.showFallingNotes,
  showKeyboard: true,
  showKeyLabels: settings.showKeyLabels,
  showNoteLabels: settings.showNoteLabels,
  showFingerHints: settings.showFingerHints,
  showColoredFingerHints: settings.showColoredFingerHints,
  keyLabelMode: settings.showKeyLabels ? settings.keyLabelMode : 'none',
  noteLabelMode: settings.showNoteLabels ? settings.noteLabelMode : 'none',
  keyLabelSize: settings.keyLabelSize,
  noteLabelSize: settings.noteLabelSize,
  orientation: settings.recordVideoOrientation,
  videoSize: settings.recordVideoSize,
  backgroundOpacity: 0.36,
  logoEnabled: !!settings.recordLogoAssetId,
}))
const exportScene = computed(() => player.session ? createRecordRenderScene(player.session, player.song?.title ?? '') : null)

function calculatePopupPosition(element: HTMLElement, popupWidth: number, popupHeight: number) {
  const rect = element.getBoundingClientRect()
  const margin = 10
  const gap = 8

  let left = rect.left - popupWidth - gap
  let top = rect.top
  let arrowOnRight = true

  if (left < margin) {
    left = rect.right + gap
    arrowOnRight = false
  }

  if (left + popupWidth > window.innerWidth - margin) {
    left = window.innerWidth - popupWidth - margin
  }

  if (top < margin) top = margin
  if (top + popupHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - popupHeight - margin)
  }

  const arrowTop = rect.top + rect.height / 2 - top
  return {
    popupStyle: { top: `${top}px`, left: `${left}px` },
    arrowStyle: arrowOnRight ? { top: `${arrowTop}px`, right: '-7px' } : { top: `${arrowTop}px`, left: '-7px' },
    arrowPlacement: arrowOnRight ? 'right' as const : 'left' as const,
  }
}

function closeMenus() {
  showSettingsDialog.value = false
  showVisualSettingsDialog.value = false
  showTrackConfigDialog.value = false
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
  showRenderMenu.value = false
}

function openSettings(event: MouseEvent) {
  if (showSettingsDialog.value) {
    showSettingsDialog.value = false
    return
  }
  showVisualSettingsDialog.value = false
  showTrackConfigDialog.value = false
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
  showRenderMenu.value = false
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 320, 260)
  settingsPopupStyle.value = popupStyle
  settingsArrowStyle.value = arrowStyle
  settingsArrowPlacement.value = arrowPlacement
  showSettingsDialog.value = true
}

function openVisualSettings(event: MouseEvent) {
  if (showVisualSettingsDialog.value) {
    showVisualSettingsDialog.value = false
    return
  }
  showSettingsDialog.value = false
  showTrackConfigDialog.value = false
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
  showRenderMenu.value = false
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 420, 520)
  visualSettingsPopupStyle.value = popupStyle
  visualSettingsArrowStyle.value = arrowStyle
  visualSettingsArrowPlacement.value = arrowPlacement
  showVisualSettingsDialog.value = true
}

function openTrackConfig(event: MouseEvent) {
  if (showTrackConfigDialog.value) {
    showTrackConfigDialog.value = false
    return
  }
  showSettingsDialog.value = false
  showVisualSettingsDialog.value = false
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
  showRenderMenu.value = false
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 420, 520)
  trackConfigPopupStyle.value = popupStyle
  trackConfigArrowStyle.value = arrowStyle
  trackConfigArrowPlacement.value = arrowPlacement
  showTrackConfigDialog.value = true
}

function openKeyboardRange(event: MouseEvent) {
  if (showKeyboardRangeDialog.value) {
    showKeyboardRangeDialog.value = false
    return
  }
  showSettingsDialog.value = false
  showVisualSettingsDialog.value = false
  showTrackConfigDialog.value = false
  showLabelsDialog.value = false
  showRenderMenu.value = false
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 360, 400)
  keyboardRangePopupStyle.value = popupStyle
  keyboardRangeArrowStyle.value = arrowStyle
  keyboardRangeArrowPlacement.value = arrowPlacement
  showKeyboardRangeDialog.value = true
}

function openLabels(event: MouseEvent) {
  if (showLabelsDialog.value) {
    showLabelsDialog.value = false
    return
  }
  showSettingsDialog.value = false
  showVisualSettingsDialog.value = false
  showTrackConfigDialog.value = false
  showKeyboardRangeDialog.value = false
  showRenderMenu.value = false
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 430, 520)
  labelsPopupStyle.value = popupStyle
  labelsArrowStyle.value = arrowStyle
  labelsArrowPlacement.value = arrowPlacement
  showLabelsDialog.value = true
}

function toggleRenderMenu() {
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
  showSettingsDialog.value = false
  showVisualSettingsDialog.value = false
  showTrackConfigDialog.value = false
  showRenderMenu.value = !showRenderMenu.value
}

function syncRecordDuration() {
  const durationUs = player.session?.loopState.durationUs ?? player.clock?.seekableDurationUs ?? 0
  if (!durationUs) return
  if (!record.hasCropRange) {
    record.initialize(durationUs)
    return
  }
  record.setCropRange(record.cropStartUs, record.cropEndUs, durationUs)
}

async function ensureSongLoaded() {
  const hash = route.params.hash as string | undefined
  if (!hash) {
    router.replace('/library')
    return false
  }

  const song = library.songByHash(hash)
  if (!song) {
    router.replace('/library')
    return false
  }

  if (!player.song || (player.song.playbackHash ?? player.song.hash) !== hash) {
    await player.loadSong(song, settings.defaultSpeed, settings.showDuration, settings.octaveShift)
  }

  await player.prepareAudio(settings.midiOutputId)
  player.configureSession({ mode: 'listen', handSelection: 'both', speed: settings.defaultSpeed })
  syncRecordDuration()
  record.clearExportState()
  return true
}

function cropEndForPreset(preset: RecordExportPreset) {
  if (!preset.endsWith('10s')) return record.cropEndUs
  return Math.min(record.cropEndUs, record.cropStartUs + 10_000_000)
}

function triggerDownload(blob: Blob, fileName: string) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function buildExportFileName(preset: RecordExportPreset) {
  const title = player.song?.title || 'record-render'
  const ext = preset.startsWith('mp4') ? 'mp4' : 'webm'
  return `${title}.${ext}`
}

function presetLabelKey(preset: RecordExportPreset) {
  switch (preset) {
    case 'mp4-full': return 'record.presets.mp4Full'
    case 'webm-full': return 'record.presets.webmFull'
    case 'mp4-10s': return 'record.presets.mp410s'
    case 'webm-10s': return 'record.presets.webm10s'
  }
}

function handleWorkerProgress(message: RenderExportProgressMessage) {
  record.updateExportProgress(message.stage, message.percent, t(`record.exportStages.${message.stage}`))
  toast.showLoading(t(`record.exportStages.${message.stage}`))
  toast.updateProgress(message.percent)
}

async function runRenderPreset(preset: RecordExportPreset) {
  showRenderMenu.value = false
  if (!player.session || !exportScene.value) return

  const supported = typeof Worker !== 'undefined' && typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
  if (!supported) {
    const message = t('record.exportUnsupported')
    record.failExport(message)
    toast.showError(message)
    return
  }

  record.setExportPreset(preset)
  record.startExport(t('record.exportStages.preparing'))
  toast.showLoading(t('record.exportQueued'))

  try {
    const result = await renderExportJob({
      preset,
      scene: exportScene.value,
      visuals: exportVisuals.value,
      cropStartUs: record.cropStartUs,
      cropEndUs: cropEndForPreset(preset),
      outputVolume: settings.recordOutputVolume,
      backgroundAssetId: settings.recordBackgroundAssetId,
      logoAssetId: settings.recordLogoAssetId,
      onProgress: handleWorkerProgress,
    })

    triggerDownload(new Blob([result.data], { type: result.mimeType }), buildExportFileName(preset))
    const successMessage = t('record.exportSuccessPreset', { preset: t(presetLabelKey(preset)) })
    record.finishExport(successMessage)
    toast.showSuccess(successMessage)
    void playRenderCompleteSound()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    record.failExport(message)
    toast.showError(t('record.exportFailed', { message }))
  }
}

onMounted(async () => {
  const ok = await ensureSongLoaded()
  if (!ok) return
  await nextTick()
})

watch(() => player.session?.loopState.durationUs, syncRecordDuration)
watch(() => route.params.hash, async () => {
  await ensureSongLoaded()
})
watch(() => player.song?.id, () => {
  closeMenus()
  record.clearExportState()
})

onBeforeUnmount(() => {
  closeMenus()
  player.stopPlayback()
})
</script>

<template>
  <main v-if="player.session && player.song" class="record-layout">
    <RecordTopBar
      :settings-open="showSettingsDialog"
      :visual-settings-open="showVisualSettingsDialog"
      :track-config-open="showTrackConfigDialog"
      :keyboard-range-open="showKeyboardRangeDialog"
      :labels-open="showLabelsDialog"
      :render-menu-open="showRenderMenu"
      @open-settings="openSettings"
      @open-visual-settings="openVisualSettings"
      @open-track-config="openTrackConfig"
      @open-keyboard-range="openKeyboardRange"
      @open-labels="openLabels"
      @toggle-render-menu="toggleRenderMenu"
      @close-render-menu="showRenderMenu = false"
      @run-render-preset="runRenderPreset"
    />

    <TrackProgressBar
      crop-range-active
      :crop-start-us="record.cropStartUs"
      :crop-end-us="record.cropEndUs"
      @update-crop-range="record.setCropRange"
    />

    <section class="record-stage-area">
      <div v-if="showExportStatus" class="export-status">
        <strong>{{ t('record.exportProgress') }}</strong>
        <span>{{ record.exportProgress.message || t(`record.exportStages.${record.exportProgress.stage}`) }}</span>
        <span v-if="record.exporting">{{ record.exportProgress.percent }}%</span>
        <span v-else-if="record.lastExportError" class="error">{{ record.lastExportError }}</span>
      </div>
      <RecordStageCanvas />
    </section>

    <RecordSettingsDialog
      :show="showSettingsDialog"
      :popup-style="settingsPopupStyle"
      :arrow-style="settingsArrowStyle"
      :arrow-placement="settingsArrowPlacement"
      @close="showSettingsDialog = false"
    />

    <RecordVisualSettingsDialog
      :show="showVisualSettingsDialog"
      :popup-style="visualSettingsPopupStyle"
      :arrow-style="visualSettingsArrowStyle"
      :arrow-placement="visualSettingsArrowPlacement"
      @close="showVisualSettingsDialog = false"
    />

    <TrackConfigDialog
      :show="showTrackConfigDialog"
      :popup-style="trackConfigPopupStyle"
      :arrow-style="trackConfigArrowStyle"
      :arrow-placement="trackConfigArrowPlacement"
      @close="showTrackConfigDialog = false"
    />

    <KeyboardRangeDialog
      :show="showKeyboardRangeDialog"
      :popup-style="keyboardRangePopupStyle"
      :arrow-style="keyboardRangeArrowStyle"
      :arrow-placement="keyboardRangeArrowPlacement"
      @close="showKeyboardRangeDialog = false"
    />

    <LabelsDialog
      :show="showLabelsDialog"
      :popup-style="labelsPopupStyle"
      :arrow-style="labelsArrowStyle"
      :arrow-placement="labelsArrowPlacement"
      @close="showLabelsDialog = false"
    />
  </main>
</template>

<style scoped>
.record-layout {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  background: #2b2d31;
  overflow: hidden;
}

.record-stage-area {
  position: relative;
  min-height: 0;
}

.export-status {
  position: absolute;
  z-index: 20;
  top: 0.75rem;
  right: 0.85rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  background: rgba(17, 24, 39, 0.78);
  color: #e5e7eb;
  font-size: 0.82rem;
  backdrop-filter: blur(6px);
}

.export-status .error {
  color: #fca5a5;
  max-width: 24rem;
  text-align: right;
}
</style>
