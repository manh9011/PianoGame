<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePlayerStore } from '../../stores/playerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { LEAD_IN_US } from '../../modules/midi/midiPlayerClock'
import { WHITE_KEY_COUNT } from '../../modules/render/pianoGeometry'
import { loadRenderAssetBlob } from '../../modules/storage/renderAssetStore'
import { resolveRecordVideoDimensions } from '../../modules/render/record/recordRenderModel'
import PianoRoll from './PianoRoll.vue'
import PianoKeyboard from './PianoKeyboard.vue'
import SongTitleIntroOverlay from './SongTitleIntroOverlay.vue'

const WHITE_KEY_ASPECT_RATIO = 150 / 23.5
const BLACK_KEY_HEIGHT_RATIO = 95 / 150

const player = usePlayerStore()
const settings = useSettingsStore()
const stageRef = ref<HTMLElement | null>(null)
const keyboardHeight = ref(150)
const blackKeyHeight = ref(95)
const frameWidth = ref(0)
const frameHeight = ref(0)
const backgroundUrl = ref('')
const logoUrl = ref('')
const currentUs = computed(() => player.session?.currentUs ?? -LEAD_IN_US)
const title = computed(() => player.song?.title ?? '')
const previewAspectRatio = computed(() => {
  const dimensions = resolveRecordVideoDimensions(settings.recordVideoSize, settings.recordVideoOrientation)
  return dimensions.width / dimensions.height
})
const frameStyle = computed(() => ({
  width: frameWidth.value ? `${frameWidth.value}px` : '100%',
  height: frameHeight.value ? `${frameHeight.value}px` : '100%',
}))
const backgroundStyle = computed(() => backgroundUrl.value ? { backgroundImage: `url(${backgroundUrl.value})` } : {})
const showLogo = computed(() => !!logoUrl.value)
let resizeObserver: ResizeObserver | null = null
let backgroundObjectUrl = ''
let logoObjectUrl = ''
let assetLoadToken = 0

function revokeAssetUrl(type: 'background' | 'logo') {
  if (type === 'background') {
    if (backgroundObjectUrl) URL.revokeObjectURL(backgroundObjectUrl)
    backgroundObjectUrl = ''
    backgroundUrl.value = ''
    return
  }
  if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl)
  logoObjectUrl = ''
  logoUrl.value = ''
}

async function loadAssetPreview(type: 'background' | 'logo', assetId: string, token: number) {
  revokeAssetUrl(type)
  if (!assetId) return
  const blob = await loadRenderAssetBlob(assetId)
  if (token !== assetLoadToken || !blob) return
  const url = URL.createObjectURL(blob)
  if (type === 'background') {
    backgroundObjectUrl = url
    backgroundUrl.value = url
    return
  }
  logoObjectUrl = url
  logoUrl.value = url
}

function refreshAssetPreviews() {
  const token = ++assetLoadToken
  void loadAssetPreview('background', settings.recordBackgroundAssetId, token)
  void loadAssetPreview('logo', settings.recordLogoAssetId, token)
}

function updatePreviewLayout() {
  if (!stageRef.value) return
  const availableWidth = stageRef.value.clientWidth
  const availableHeight = stageRef.value.clientHeight
  if (!availableWidth || !availableHeight) return
  const aspectRatio = previewAspectRatio.value
  const byWidthHeight = availableWidth / aspectRatio
  if (byWidthHeight <= availableHeight) {
    frameWidth.value = availableWidth
    frameHeight.value = byWidthHeight
  } else {
    frameHeight.value = availableHeight
    frameWidth.value = availableHeight * aspectRatio
  }
  const whiteKeyWidth = frameWidth.value / WHITE_KEY_COUNT
  keyboardHeight.value = whiteKeyWidth * WHITE_KEY_ASPECT_RATIO
  blackKeyHeight.value = keyboardHeight.value * BLACK_KEY_HEIGHT_RATIO
}

onMounted(async () => {
  refreshAssetPreviews()
  await nextTick()
  updatePreviewLayout()
  if (typeof ResizeObserver !== 'undefined' && stageRef.value) {
    resizeObserver = new ResizeObserver(updatePreviewLayout)
    resizeObserver.observe(stageRef.value)
  }
})

watch(() => [settings.recordBackgroundAssetId, settings.recordLogoAssetId], refreshAssetPreviews)
watch(previewAspectRatio, () => nextTick(updatePreviewLayout))

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  assetLoadToken += 1
  revokeAssetUrl('background')
  revokeAssetUrl('logo')
})
</script>

<template>
  <section
    ref="stageRef"
    class="record-stage-layout"
    :style="{
      '--keyboard-height': `${keyboardHeight}px`,
      '--black-key-height': `${blackKeyHeight}px`,
      '--preview-aspect-ratio': String(previewAspectRatio),
    }"
  >
    <div class="record-stage-frame" :style="frameStyle">
      <div class="record-stage-content">
        <div class="record-background" :style="backgroundStyle"></div>
        <section class="record-roll-area">
          <PianoRoll transparent-background />
          <img v-if="showLogo" class="record-logo" :src="logoUrl" alt="" />
        </section>
        <section class="record-keyboard-shell">
          <PianoKeyboard transparent-background preview-active-from-timeline />
        </section>
        <SongTitleIntroOverlay
          :title="title"
          :current-us="currentUs"
          started
          :manually-stopped="player.playbackManuallyStopped"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.record-stage-layout {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: #202226;
  overflow: hidden;
}

.record-stage-frame {
  flex: 0 0 auto;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: #000;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.42);
}

.record-stage-content {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) var(--keyboard-height);
  overflow: hidden;
  background: #303030;
}

.record-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  pointer-events: none;
}

.record-background::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(48, 48, 48, 0.6);
}

.record-roll-area {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.record-logo {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 4;
  width: 40px;
  height: 40px;
  object-fit: cover;
  opacity: 0.88;
  pointer-events: none;
}

.record-keyboard-shell {
  position: relative;
  z-index: 1;
  height: var(--keyboard-height);
  min-height: 0;
  opacity: 0.85;
}
</style>
