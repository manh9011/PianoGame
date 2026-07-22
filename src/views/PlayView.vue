<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/playerStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { bindInput, requestMidiAccess } from '../modules/midi/webMidi'
import { WHITE_KEY_COUNT } from '../modules/render/pianoGeometry'
import type { HandSelection, PlayMode } from '../modules/game/playSession'
import PlayTopBar from '../components/player/PlayTopBar.vue'
import TrackProgressBar from '../components/player/TrackProgressBar.vue'
import SheetMusicPanel from '../components/player/SheetMusicPanel.vue'
import PianoRoll from '../components/player/PianoRoll.vue'
import PianoKeyboard from '../components/player/PianoKeyboard.vue'
import ScorePanel from '../components/player/ScorePanel.vue'
import PerformanceOverlay from '../components/player/PerformanceOverlay.vue'
import GameplayFeedbackOverlay from '../components/player/GameplayFeedbackOverlay.vue'
import HelpOverlay from '../components/player/HelpOverlay.vue'
import MetronomeDialog from '../components/player/dialogs/MetronomeDialog.vue'
import KeyboardRangeDialog from '../components/player/dialogs/KeyboardRangeDialog.vue'
import LabelsDialog from '../components/player/dialogs/LabelsDialog.vue'
import BookmarksDialog from '../components/player/dialogs/BookmarksDialog.vue'
import LoopControl from '../components/player/LoopControl.vue'
import LoopPerformanceOverlay from '../components/player/LoopPerformanceOverlay.vue'
import SettingsDialog from '../components/player/dialogs/SettingsDialog.vue'
import TrackConfigDialog from '../components/player/dialogs/TrackConfigDialog.vue'
import { freezePlaybackProfiler, resumePlaybackProfiler, setPlaybackProfilerMode, type PlaybackProfilerSnapshot } from '../modules/perf/playbackProfiler'

const WHITE_KEY_ASPECT_RATIO = 150 / 23.5  // 6.383
const BLACK_KEY_HEIGHT_RATIO = 95 / 150    // 0.633
const BENCHMARK_STORAGE_KEY = 'pianogame:perf'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()
const profiles = useProfileStore()
const settings = useSettingsStore()
let saved = false
let midiAccess: Awaited<ReturnType<typeof requestMidiAccess>> = null

const playLayoutRef = ref<HTMLElement>()
const keyboardHeight = ref(150)
const blackKeyHeight = ref(95)

const showMetronomeDialog = ref(false)
const showTrackConfigDialog = ref(false)
const showKeyboardRangeDialog = ref(false)
const showLabelsDialog = ref(false)
const showBookmarksDialog = ref(false)
const showLoopControl = ref(false)
const showSettingsDialog = ref(false)
const showHelpOverlay = ref(false)
const showPerformanceDetail = ref(false)
const frozenPerformanceSnapshot = ref<PlaybackProfilerSnapshot | null>(null)
const isFullscreen = ref(false)
const wasPlayingBeforeDialog = ref(false)
const sheetReady = ref(!settings.showSheetMusic)
const shouldStartAfterSheetReady = ref(false)
const wasPlayingBeforeSheetLoad = ref(false)
const benchmarkMode = ref(
  window.location.search.includes('perf=1') ||
  window.location.hash.includes('perf=1') ||
  localStorage.getItem(BENCHMARK_STORAGE_KEY) === '1'
)

const hasBlockingOverlay = computed(() =>
  showMetronomeDialog.value ||
  showTrackConfigDialog.value ||
  showKeyboardRangeDialog.value ||
  showLabelsDialog.value ||
  showBookmarksDialog.value ||
  showSettingsDialog.value ||
  showHelpOverlay.value ||
  showPerformanceDetail.value
)
const showPerformanceOverlay = computed(() => benchmarkMode.value || settings.advancedEnableDebugOverlay)
const showPerformanceDetails = computed(() => benchmarkMode.value)

// Popover positions
const metronomePopupStyle = ref({ top: '0px', left: '0px' })
const metronomeArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const metronomeArrowPlacement = ref<'left' | 'right'>('right')

const trackConfigPopupStyle = ref({ top: '0px', left: '0px' })
const trackConfigArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const trackConfigArrowPlacement = ref<'left' | 'right'>('right')

const keyboardRangePopupStyle = ref({ top: '0px', left: '0px' })
const keyboardRangeArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const keyboardRangeArrowPlacement = ref<'left' | 'right'>('right')

const labelsPopupStyle = ref({ top: '0px', left: '0px' })
const labelsArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const labelsArrowPlacement = ref<'left' | 'right'>('right')

const settingsPopupStyle = ref({ top: '0px', left: '0px' })
const settingsArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const settingsArrowPlacement = ref<'left' | 'right'>('right')

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

  if (top < margin) {
    top = margin
  }

  if (top + popupHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - popupHeight - margin)
  }

  const arrowTop = rect.top + rect.height / 2 - top

  return {
    popupStyle: { top: `${top}px`, left: `${left}px` },
    arrowStyle: arrowOnRight ? { top: `${arrowTop}px`, right: '-7px' } : { top: `${arrowTop}px`, left: '-7px' },
    arrowPlacement: arrowOnRight ? 'right' as const : 'left' as const
  }
}

function updateKeyboardHeight() {
  if (!playLayoutRef.value) return
  const containerWidth = playLayoutRef.value.offsetWidth
  if (containerWidth === 0) return // DOM chưa render xong
  const whiteKeyWidth = containerWidth / WHITE_KEY_COUNT
  keyboardHeight.value = whiteKeyWidth * WHITE_KEY_ASPECT_RATIO
  blackKeyHeight.value = keyboardHeight.value * BLACK_KEY_HEIGHT_RATIO
}

let resizeObserver: ResizeObserver | null = null

function closeAllDialogs() {
  showMetronomeDialog.value = false
  showTrackConfigDialog.value = false
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
  showBookmarksDialog.value = false
  showLoopControl.value = false
  showSettingsDialog.value = false
}

function openMetronome(event: MouseEvent) {
  if (showMetronomeDialog.value) {
    showMetronomeDialog.value = false
    return
  }
  closeAllDialogs()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 320, 300)
  metronomePopupStyle.value = popupStyle
  metronomeArrowStyle.value = arrowStyle
  metronomeArrowPlacement.value = arrowPlacement
  showMetronomeDialog.value = true
}

function openTrackConfig(event: MouseEvent) {
  if (showTrackConfigDialog.value) {
    showTrackConfigDialog.value = false
    return
  }
  closeAllDialogs()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 420, 420)
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
  closeAllDialogs()
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
  closeAllDialogs()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 360, 500)
  labelsPopupStyle.value = popupStyle
  labelsArrowStyle.value = arrowStyle
  labelsArrowPlacement.value = arrowPlacement
  showLabelsDialog.value = true
}

function openBookmarks() {
  if (showBookmarksDialog.value) {
    showBookmarksDialog.value = false
    return
  }
  closeAllDialogs()
  showBookmarksDialog.value = true
}

function openLoop() {
  if (showLoopControl.value) {
    showLoopControl.value = false
    return
  }
  closeAllDialogs()
  showLoopControl.value = true
}

function openSettings(event: MouseEvent) {
  if (showSettingsDialog.value) {
    showSettingsDialog.value = false
    return
  }
  closeAllDialogs()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 280, 250)
  settingsPopupStyle.value = popupStyle
  settingsArrowStyle.value = arrowStyle
  settingsArrowPlacement.value = arrowPlacement
  showSettingsDialog.value = true
}

function toggleBenchmark() {
  benchmarkMode.value = !benchmarkMode.value
  localStorage.setItem(BENCHMARK_STORAGE_KEY, benchmarkMode.value ? '1' : '0')
}

function togglePerformanceAutoPlay() {
  player.setPerformanceAutoPlay(!player.performanceAutoPlay)
}

function stopPlayback() {
  player.stopPlayback()
}

function openPerformanceDetail() {
  frozenPerformanceSnapshot.value = freezePlaybackProfiler()
  showPerformanceDetail.value = true
}

function closePerformanceDetail() {
  showPerformanceDetail.value = false
  frozenPerformanceSnapshot.value = null
  resumePlaybackProfiler()
}

function toggleHelpOverlay() {
  showHelpOverlay.value = !showHelpOverlay.value
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Lỗi khi bật fullscreen: ${err.message}`)
    })
  } else {
    document.exitFullscreen()
  }
}

function isBrowserFullscreen() {
  return Math.abs(window.innerWidth - screen.width) <= 1 && Math.abs(window.innerHeight - screen.height) <= 1
}

function updateFullscreenState() {
  isFullscreen.value = !!document.fullscreenElement || isBrowserFullscreen()
}

function handleFullscreenShortcut(event: KeyboardEvent) {
  if (event.key === 'F11') {
    setTimeout(updateFullscreenState, 100)
  }
}

function startWhenSheetIsReady() {
  if (settings.showSheetMusic && !sheetReady.value) {
    shouldStartAfterSheetReady.value = true
    return
  }
  shouldStartAfterSheetReady.value = false
  player.start()
}

function handleSheetReady() {
  sheetReady.value = true
  if (shouldStartAfterSheetReady.value) {
    shouldStartAfterSheetReady.value = false
    player.start()
  }
}

onMounted(async () => {
  const hash = route.params.hash as string
  const modeId = route.params.modeId as string

  if (!hash || !modeId) {
    router.replace('/library')
    return
  }

  const song = library.songByHash(hash)
  if (!song) {
    console.warn('Không tìm thấy bài hát với hash:', hash)
    router.replace('/library')
    return
  }

  let mode: PlayMode
  let handSelection: HandSelection

  if (modeId === 'listen') {
    mode = 'listen'
    handSelection = 'both'
  } else {
    const parts = modeId.split('-')
    if (parts.length !== 2) {
      console.warn('Invalid modeId format:', modeId)
      router.replace('/library')
      return
    }
    mode = parts[0] as PlayMode
    handSelection = parts[1] as HandSelection
  }

  if (!player.song || (player.song.playbackHash ?? player.song.hash) !== hash) {
    await player.loadSong(song, settings.defaultSpeed, settings.showDuration, settings.octaveShift)
  }

  if (!player.session || !player.session.setupComplete ||
      player.session.mode !== mode || player.session.handSelection !== handSelection) {
    await player.prepareAudio(settings.midiOutputId)
    player.configureSession({ mode, handSelection, speed: settings.defaultSpeed })
  }

  sheetReady.value = !settings.showSheetMusic
  startWhenSheetIsReady()
  midiAccess = await requestMidiAccess()
  bindInput(midiAccess, settings.midiInputId, (note, _velocity, on) => player.noteInput(note, on))

  document.addEventListener('fullscreenchange', updateFullscreenState)
  window.addEventListener('resize', updateFullscreenState)
  window.addEventListener('keyup', handleFullscreenShortcut)
  updateFullscreenState()

  await nextTick()
  updateKeyboardHeight()
  if (playLayoutRef.value) {
    resizeObserver = new ResizeObserver(updateKeyboardHeight)
    resizeObserver.observe(playLayoutRef.value)
  }
})

onBeforeUnmount(() => {
  bindInput(midiAccess, '', () => {})
  document.removeEventListener('fullscreenchange', updateFullscreenState)
  window.removeEventListener('resize', updateFullscreenState)
  window.removeEventListener('keyup', handleFullscreenShortcut)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

watch(() => settings.keyboardRangeMode, () => {
  player.refreshKeyboardRange()
})

watch(() => settings.showSheetMusic, show => {
  if (show) {
    sheetReady.value = false
    wasPlayingBeforeSheetLoad.value = !!player.clock?.state.running
    if (wasPlayingBeforeSheetLoad.value) {
      player.clock?.pause()
      if (player.session) player.session.paused = true
      player.autoPlayer.allNotesOff(player.session)
    }
    shouldStartAfterSheetReady.value = wasPlayingBeforeSheetLoad.value
    return
  }

  sheetReady.value = true
  shouldStartAfterSheetReady.value = false
  wasPlayingBeforeSheetLoad.value = false
})

watch(showPerformanceOverlay, enabled => {
  setPlaybackProfilerMode({ summaryEnabled: enabled, detailEnabled: showPerformanceDetails.value })
}, { immediate: true })

watch(showPerformanceDetails, detailed => {
  setPlaybackProfilerMode({ summaryEnabled: showPerformanceOverlay.value, detailEnabled: detailed })
}, { immediate: true })

watch(hasBlockingOverlay, open => {
  const session = player.session
  if (!session?.setupComplete || session.finished || player.stats) {
    wasPlayingBeforeDialog.value = false
    return
  }

  if (open) {
    wasPlayingBeforeDialog.value = !!player.clock?.state.running
    if (wasPlayingBeforeDialog.value) {
      player.clock?.pause()
      session.paused = true
      player.autoPlayer.allNotesOff(session)
    }
    return
  }

  if (wasPlayingBeforeDialog.value && !player.clock?.state.running) {
    player.start()
  }
  wasPlayingBeforeDialog.value = false
})

watch(() => player.stats, stats => {
  if (!stats || !player.song || saved) return
  saved = true
  const song = player.song
  if (!player.performanceAutoPlayUsed) {
    profiles.recordScore(song.id, stats)
    if (stats.mode !== 'listen') library.updateAfterPlay(song.id, stats.score)
  }

  setTimeout(() => {
    router.push(`/mode-select/${song.playbackHash ?? song.hash}`)
  }, 250)
})
</script>

<template>
  <main
    v-if="player.session && player.song"
    ref="playLayoutRef"
    class="play-layout"
    :class="{ 'with-sheet': settings.showSheetMusic }"
    :style="{ '--keyboard-height': `${keyboardHeight}px`, '--black-key-height': `${blackKeyHeight}px` }"
  >
    <PlayTopBar
      :is-fullscreen="isFullscreen"
      :bookmarks-dialog-open="showBookmarksDialog"
      :loop-dialog-open="showLoopControl"
      :help-overlay-open="showHelpOverlay"
      :benchmark-mode="benchmarkMode"
      :performance-auto-play="player.performanceAutoPlay"
      :playback-blocked="settings.showSheetMusic && !sheetReady"
      @open-metronome="openMetronome"
      @open-track-config="openTrackConfig"
      @open-keyboard-range="openKeyboardRange"
      @open-labels="openLabels"
      @open-bookmarks="openBookmarks"
      @open-loop="openLoop"
      @open-settings="openSettings"
      @toggle-benchmark="toggleBenchmark"
      @toggle-performance-auto-play="togglePerformanceAutoPlay"
      @toggle-help="toggleHelpOverlay"
      @stop-playback="stopPlayback"
      @toggle-fullscreen="toggleFullscreen"
    />
    <TrackProgressBar :loop-setup-active="showLoopControl" />
    <SheetMusicPanel v-if="settings.showSheetMusic" @ready="handleSheetReady" />
    <section class="play-stage">
      <section class="kbd-area">
        <PianoRoll :bookmark-mode="showBookmarksDialog" :benchmark-mode="benchmarkMode" :loop-setup-active="showLoopControl" />
      </section>
      <PerformanceOverlay
        v-if="showPerformanceOverlay && !showPerformanceDetail"
        variant="mini"
        @open-detail="openPerformanceDetail"
      />
      <ScorePanel />
      <LoopPerformanceOverlay />
      <GameplayFeedbackOverlay />
    </section>
    <PianoKeyboard />
    <HelpOverlay :show="showHelpOverlay" />
    <PerformanceOverlay
      v-if="showPerformanceDetail && frozenPerformanceSnapshot"
      variant="detail"
      :snapshot-override="frozenPerformanceSnapshot"
      @close-detail="closePerformanceDetail"
    />

    <!-- Dialogs -->
    <SettingsDialog
      :show="showSettingsDialog"
      :popup-style="settingsPopupStyle"
      :arrow-style="settingsArrowStyle"
      :arrow-placement="settingsArrowPlacement"
      @close="showSettingsDialog = false"
    />
    <MetronomeDialog
      :show="showMetronomeDialog"
      :popup-style="metronomePopupStyle"
      :arrow-style="metronomeArrowStyle"
      :arrow-placement="metronomeArrowPlacement"
      @close="showMetronomeDialog = false"
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
    <BookmarksDialog
      :show="showBookmarksDialog"
    />
    <LoopControl
      :show="showLoopControl"
    />
  </main>
</template>

<style scoped>
.play-layout {
  height: 100vh;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) var(--keyboard-height);
  background: #2b2d31;
  overflow: hidden;
}

.play-layout.with-sheet {
  grid-template-rows: auto auto auto minmax(0, 1fr) var(--keyboard-height);
}

.play-stage {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  overflow: hidden;
}

.kbd-area {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

@media (max-width: 900px) {
  .play-stage {
    grid-template-columns: 1fr;
  }
}
</style>
