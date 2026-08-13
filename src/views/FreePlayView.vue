<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { getFreePlayTrackLoopDurationUs, parseFreePlayTimeSignature, useFreePlayStore } from '../stores/freePlayStore'
import { usePlayerStore } from '../stores/playerStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { bindInput, requestMidiAccess } from '../modules/midi/webMidi'
import { WHITE_KEY_COUNT } from '../modules/render/pianoGeometry'
import { createFreePlayMidi } from '../modules/midi/freePlayMidiExport'
import { getInstrumentByProgram } from '../modules/audio/gmInstrumentCatalog'
import FreePlayTopBar from '../components/player/FreePlayTopBar.vue'
import FreePlayProgressBar from '../components/player/FreePlayProgressBar.vue'
import FreePlayTrackManager from '../components/player/FreePlayTrackManager.vue'
import FreePlayPianoRoll from '../components/player/FreePlayPianoRoll.vue'
import PianoKeyboard from '../components/player/PianoKeyboard.vue'
import FreePlayPracticeDialog from '../components/player/dialogs/FreePlayPracticeDialog.vue'
import FreePlaySettingsDialog from '../components/player/dialogs/FreePlaySettingsDialog.vue'
import FreePlayMetronomeDialog from '../components/player/dialogs/FreePlayMetronomeDialog.vue'
import KeyboardRangeDialog from '../components/player/dialogs/KeyboardRangeDialog.vue'
import LabelsDialog from '../components/player/dialogs/LabelsDialog.vue'
import FreePlayTrackEditorDialog from '../components/player/dialogs/FreePlayTrackEditorDialog.vue'

import { useShortcuts } from '../composables/useShortcuts'

const WHITE_KEY_ASPECT_RATIO = 150 / 23.5
const BLACK_KEY_HEIGHT_RATIO = 95 / 150

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { confirm } = useConfirmDialog()
const freePlay = useFreePlayStore()
const player = usePlayerStore()
const settings = useSettingsStore()
const toast = useToastStore()

let midiAccess: Awaited<ReturnType<typeof requestMidiAccess>> = null
let unsubscribeNoteInput: (() => void) | undefined
let resizeObserver: ResizeObserver | null = null
let timerId: number | null = null
const backingActiveVoiceIds = new Set<string>()

let playbackTimerId: number | null = null
let playbackStartedAtMs = 0
let playbackStartUs = 0
const playbackActiveVoiceIds = new Set<string>()
const timelineEndUs = computed(() => Math.max(0, ...freePlay.tracks.flatMap(track => track.notes.map(note => note.endUs))))

const freePlayLayoutRef = ref<HTMLElement>()
const keyboardHeight = ref(150)
const blackKeyHeight = ref(95)
const isFullscreen = ref(false)
const showPracticeDialog = ref(false)
const showSettingsDialog = ref(false)
const showMetronomeDialog = ref(false)
const showKeyboardRangeDialog = ref(false)
const showLabelsDialog = ref(false)
const showTrackEditorDialog = ref(false)
const settingsPopupStyle = ref({ top: '0px', left: '0px' })
const settingsArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const settingsArrowPlacement = ref<'left' | 'right'>('right')
const metronomePopupStyle = ref({ top: '0px', left: '0px' })
const metronomeArrowStyle = ref<{ top?: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const metronomeArrowPlacement = ref<'left' | 'right' | 'top'>('right')
const keyboardRangePopupStyle = ref({ top: '0px', left: '0px' })
const keyboardRangeArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const keyboardRangeArrowPlacement = ref<'left' | 'right'>('right')
const importingFromLibrarySongId = ref<string | null>(null)
const labelsPopupStyle = ref({ top: '0px', left: '0px' })
const labelsArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const labelsArrowPlacement = ref<'left' | 'right'>('right')
const selectedTrackMonitorKey = computed(() => {
  const track = freePlay.selectedTrack
  return `${track.id}:${track.instrumentProgram}:${track.color}`
})

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

  const arrowTop = Math.max(12, Math.min(popupHeight - 24, rect.top + rect.height / 2 - top - 7))
  return {
    popupStyle: { top: `${top}px`, left: `${left}px` },
    arrowStyle: arrowOnRight ? { top: `${arrowTop}px`, right: '-7px' } : { top: `${arrowTop}px`, left: '-7px' },
    arrowPlacement: arrowOnRight ? 'right' as const : 'left' as const,
  }
}

function calculateBottomPopupPosition(element: HTMLElement, popupWidth: number, popupHeight: number) {
  const rect = element.getBoundingClientRect()
  const margin = 10
  const gap = 8

  let left = rect.left + rect.width / 2 - popupWidth / 2
  let top = rect.bottom + gap

  if (left < margin) left = margin
  if (left + popupWidth > window.innerWidth - margin) {
    left = window.innerWidth - popupWidth - margin
  }
  if (top + popupHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - popupHeight - margin)
  }

  const arrowLeft = rect.left + rect.width / 2 - left
  return {
    popupStyle: { top: `${top}px`, left: `${left}px` },
    arrowStyle: { top: '-7px', left: `${arrowLeft}px` },
    arrowPlacement: 'top' as const,
  }
}

function closeDialogs() {
  showPracticeDialog.value = false
  showSettingsDialog.value = false
  showMetronomeDialog.value = false
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
  showTrackEditorDialog.value = false
}

function closePopovers() {
  showSettingsDialog.value = false
  showMetronomeDialog.value = false
  showKeyboardRangeDialog.value = false
  showLabelsDialog.value = false
}

function openSettings(event: MouseEvent) {
  if (showSettingsDialog.value) {
    showSettingsDialog.value = false
    return
  }
  closeDialogs()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 500, 390)
  settingsPopupStyle.value = popupStyle
  settingsArrowStyle.value = arrowStyle
  settingsArrowPlacement.value = arrowPlacement
  showSettingsDialog.value = true
}

function openMetronome(event: MouseEvent) {
  if (showMetronomeDialog.value) {
    showMetronomeDialog.value = false
    return
  }
  closeDialogs()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculateBottomPopupPosition(element, 420, 520)
  metronomePopupStyle.value = popupStyle
  metronomeArrowStyle.value = arrowStyle
  metronomeArrowPlacement.value = arrowPlacement
  showMetronomeDialog.value = true
}

function openKeyboardRange(event: MouseEvent) {
  if (showKeyboardRangeDialog.value) {
    showKeyboardRangeDialog.value = false
    return
  }
  closeDialogs()
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
  closeDialogs()
  const element = event.currentTarget as HTMLElement
  const { popupStyle, arrowStyle, arrowPlacement } = calculatePopupPosition(element, 430, 520)
  labelsPopupStyle.value = popupStyle
  labelsArrowStyle.value = arrowStyle
  labelsArrowPlacement.value = arrowPlacement
  showLabelsDialog.value = true
}

let initialPinchDistance = 0
let initialPinchZoom = 0

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    initialPinchZoom = settings.zoomPercent
  }
}

function handleTouchMove(e: TouchEvent) {
  if (e.touches.length === 2) {
    if (e.cancelable) e.preventDefault()
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
    const scale = currentDistance / initialPinchDistance
    let newPercent = initialPinchZoom * scale
    newPercent = Math.max(50, Math.min(200, newPercent))
    settings.setZoomPercent(newPercent)
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (e.touches.length < 2) {
    initialPinchDistance = 0
  }
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey) {
    e.preventDefault()
    const currentZoom = settings.zoomPercent
    const scaleDelta = e.deltaY * -0.2
    let newPercent = currentZoom + scaleDelta
    newPercent = Math.max(50, Math.min(200, newPercent))
    settings.setZoomPercent(newPercent)
  }
}

function updateKeyboardHeight() {
  if (!freePlayLayoutRef.value) return
  const containerWidth = freePlayLayoutRef.value.offsetWidth
  if (!containerWidth) return
  const whiteKeyWidth = containerWidth / WHITE_KEY_COUNT
  keyboardHeight.value = whiteKeyWidth * WHITE_KEY_ASPECT_RATIO
  blackKeyHeight.value = keyboardHeight.value * BLACK_KEY_HEIGHT_RATIO
}

function syncMonitorTrack() {
  const track = freePlay.selectedTrack
  player.setFreePlayMonitorTrack(track.id, track.instrumentProgram, track.color)
}

function backingVoiceId(trackId: number, noteId: string, loopIndex: number) {
  return `free-play-backing:${trackId}:${noteId}:${loopIndex}`
}

function stopBackingPlayback() {
  for (const voiceId of backingActiveVoiceIds) player.inputSynth.noteOff(voiceId)
  backingActiveVoiceIds.clear()
}

function tickBackingPlayback(durationUs: number) {
  const active = new Set<string>()
  for (const track of freePlay.tracks) {
    if (track.id === freePlay.recordingTrackId || !track.notes.length) continue
    const loopDurationUs = getFreePlayTrackLoopDurationUs(track, freePlay.bpm, freePlay.timeSignature)
    if (loopDurationUs <= 0) continue
    const loopIndex = track.loop ? Math.floor(durationUs / loopDurationUs) : 0
    const localUs = track.loop ? durationUs % loopDurationUs : durationUs
    if (!track.loop && durationUs > loopDurationUs) continue
    const soundfontId = getInstrumentByProgram(track.instrumentProgram).soundfontId
    for (const note of track.notes) {
      if (note.startUs > localUs || note.endUs <= localUs) continue
      const voiceId = backingVoiceId(track.id, note.id, loopIndex)
      active.add(voiceId)
      if (backingActiveVoiceIds.has(voiceId)) continue
      backingActiveVoiceIds.add(voiceId)
      void player.inputSynth.noteOn(voiceId, note.noteId, note.velocity, soundfontId)
    }
  }

  for (const voiceId of [...backingActiveVoiceIds]) {
    if (active.has(voiceId)) continue
    player.inputSynth.noteOff(voiceId)
    backingActiveVoiceIds.delete(voiceId)
  }
}

function stopNormalPlaybackVoices() {
  for (const voiceId of playbackActiveVoiceIds) player.inputSynth.noteOff(voiceId)
  playbackActiveVoiceIds.clear()
}

function tickNormalPlayback() {
  const elapsedUs = Math.round((performance.now() - playbackStartedAtMs) * 1000)
  const durationUs = playbackStartUs + elapsedUs

  if (durationUs >= freePlay.recordingDurationUs) {
    freePlay.seekTo(0)
    if (freePlay.isPlaying) {
      togglePlayback()
    }
    return
  }

  freePlay.seekTo(durationUs)
  const active = new Set<string>()
  for (const track of freePlay.tracks) {
    if (!track.notes.length) continue
    const loopDurationUs = getFreePlayTrackLoopDurationUs(track, freePlay.bpm, freePlay.timeSignature)
    if (loopDurationUs <= 0) continue
    const loopIndex = track.loop ? Math.floor(durationUs / loopDurationUs) : 0
    const localUs = track.loop ? durationUs % loopDurationUs : durationUs
    if (!track.loop && durationUs > loopDurationUs) continue
    const soundfontId = getInstrumentByProgram(track.instrumentProgram).soundfontId
    for (const note of track.notes) {
      if (note.startUs > localUs || note.endUs <= localUs) continue
      const voiceId = `free-play-playback:${track.id}:${note.id}:${loopIndex}`
      active.add(voiceId)
      if (playbackActiveVoiceIds.has(voiceId)) continue
      playbackActiveVoiceIds.add(voiceId)
      void player.inputSynth.noteOn(voiceId, note.noteId, note.velocity, soundfontId)
    }
  }

  for (const voiceId of [...playbackActiveVoiceIds]) {
    if (active.has(voiceId)) continue
    player.inputSynth.noteOff(voiceId)
    playbackActiveVoiceIds.delete(voiceId)
  }

  if (durationUs >= timelineEndUs.value) {
    stopPlayback()
  }
}

function startPlayback() {
  if (freePlay.status === 'recording' || !freePlay.hasRecording) return
  closeDialogs()
  stopBackingPlayback()
  stopNormalPlaybackVoices()
  freePlay.setPlaying(true)
  playbackStartUs = freePlay.viewUs ?? 0
  playbackStartedAtMs = performance.now()
  tickNormalPlayback()
  playbackTimerId = window.setInterval(tickNormalPlayback, 30)
}

function stopPlayback() {
  if (playbackTimerId !== null) {
    window.clearInterval(playbackTimerId)
    playbackTimerId = null
  }
  freePlay.setPlaying(false)
  stopNormalPlaybackVoices()
}

function togglePlayback() {
  if (freePlay.isPlaying) stopPlayback()
  else startPlayback()
}

function startRecording() {
  closeDialogs()
  stopPlayback()
  stopBackingPlayback()
  syncMonitorTrack()
  freePlay.startRecording()
  player.metronome.restart()
}

function stopRecording() {
  freePlay.stopRecording()
  stopBackingPlayback()
  player.metronome.restart()
  if (!freePlay.hasRecording) toast.showError(t('freePlay.emptyRecording'))
}

function triggerDownload(blob: Blob, fileName: string) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function exportMidi() {
  if (!freePlay.hasRecording) return
  try {
    const data = createFreePlayMidi(freePlay.tracks, freePlay.bpm)
    const bytes = new Uint8Array(data.length)
    bytes.set(data)
    triggerDownload(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/midi' }), t('freePlay.midiFileName'))
    toast.showSuccess(t('freePlay.exportSuccess'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.showError(t('freePlay.exportFailed', { message }))
  }
}

async function onPracticeConfirm(songName: string) {
  if (!freePlay.hasRecording) return
  try {
    const data = createFreePlayMidi(freePlay.tracks, freePlay.bpm)
    const bytes = new Uint8Array(data.length)
    bytes.set(data)
    const file = new File([bytes.buffer as ArrayBuffer], `${songName}.mid`, { type: 'audio/midi' })

    // Import to libraryStore
    const { useLibraryStore } = await import('../stores/libraryStore')
    const library = useLibraryStore()
    const song = await library.importFile(file)

    toast.showSuccess(t('freePlay.importSuccess'))
    router.push({ name: 'mode-select', params: { hash: song.hash } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.showError(t('freePlay.exportFailed', { message }))
  }
}

function openTrackEditor() {
  if (freePlay.status === 'recording') {
    toast.showError(t('freePlay.trackEditorCannotOpenWhileRecording'))
    return
  }
  closePopovers()
  stopBackingPlayback()
  showTrackEditorDialog.value = true
}

function showImportResult(result: { truncatedTrackCount: number }) {
  if (result.truncatedTrackCount > 0) {
    toast.show(t('freePlay.importTrackLimitWarning', { count: 6 }), 'info')
    return
  }
  toast.showSuccess(t('freePlay.importSuccess'))
}

async function confirmImportReplace() {
  if (freePlay.status === 'recording') {
    toast.showError(t('freePlay.importWhileRecordingBlocked'))
    return false
  }
  if (!freePlay.hasRecording || !settings.advancedConfirmBeforeDestructiveAction) return true
  return confirm({
    title: t('freePlay.importReplaceConfirmTitle'),
    message: t('freePlay.importReplaceConfirmMessage'),
    confirmLabel: t('common.continue'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
}

function openImportedEditor() {
  closeDialogs()
  stopBackingPlayback()
  showTrackEditorDialog.value = true
}

async function importMidiFile() {
  if (!await confirmImportReplace()) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.mid,.midi,.rmi,.rmid,audio/midi,audio/x-midi'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const result = freePlay.importMidiBufferToEditor(await file.arrayBuffer())
      openImportedEditor()
      showImportResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.showError(t('freePlay.importFailed', { message }))
    }
  }, { once: true })
  input.click()
}

async function importLibrarySongToEditor(songId: string) {
  if (importingFromLibrarySongId.value === songId) return
  importingFromLibrarySongId.value = songId
  try {
    if (!await confirmImportReplace()) return
    const result = await freePlay.importLibrarySongToEditor(songId)
    openImportedEditor()
    showImportResult(result)
  } catch (error) {
    const message = error instanceof Error && error.message === 'missingMidiData'
      ? t('sheetMusic.errors.missingMidiData')
      : error instanceof Error ? error.message : String(error)
    toast.showError(t('freePlay.importFailed', { message }))
  } finally {
    importingFromLibrarySongId.value = null
    if (route.query.librarySongId) router.replace({ name: 'free-play' })
  }
}

async function deleteRecording() {
  if (!freePlay.hasRecording) return
  if (settings.advancedConfirmBeforeDestructiveAction) {
    const confirmed = await confirm({
      title: t('freePlay.deleteRecordingConfirmTitle'),
      message: t('freePlay.deleteRecordingConfirmMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    })
    if (!confirmed) return
  }
  freePlay.clearAllTrackNotes()
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

function tickFreePlayClock() {
  freePlay.tickClock()
  if (freePlay.status !== 'recording') return
  const durationUs = freePlay.recordingDurationUs
  tickBackingPlayback(durationUs)
  const signature = parseFreePlayTimeSignature(freePlay.timeSignature)
  if (!signature.enabled) return
  const quarterBeatUs = 60_000_000 / freePlay.bpm
  const beatUs = quarterBeatUs * (4 / signature.denominator)
  const beats = Array.from({ length: Math.ceil(durationUs / beatUs) + 4 }, (_, index) => ({
    timeUs: Math.round(index * beatUs),
    firstBeat: index % signature.numerator === 0,
  }))
  player.metronome.tick(beats, durationUs, {
    volume: freePlay.metronomeVolume,
    doubleSpeed: freePlay.metronomeDoubleSpeed,
    emphasizeFirstBeat: freePlay.metronomeEmphasizeFirstBeat,
  })
}

function startTimer() {
  if (timerId !== null) return
  timerId = window.setInterval(tickFreePlayClock, 50)
}

function stopTimer() {
  if (timerId === null) return
  window.clearInterval(timerId)
  timerId = null
}

useShortcuts({
  startStopRecording: () => {
    if (freePlay.status === 'recording') stopRecording()
    else startRecording()
  }
})

onMounted(async () => {
  player.loadFreePlaySession(settings.defaultSpeed, settings.leadInDuration, settings.zoomPercent, settings.octaveShift, {
    trackId: freePlay.selectedTrack.id,
    instrumentProgram: freePlay.selectedTrack.instrumentProgram,
    color: freePlay.selectedTrack.color,
  })
  await player.prepareAudio(settings.midiOutputId)
  unsubscribeNoteInput = player.subscribeNoteInput(event => freePlay.handleNoteInput(event))
  midiAccess = await requestMidiAccess()
  bindInput(midiAccess, settings.midiInputId, (note, velocity, on) => player.noteInput(note, on, { velocity, source: 'midi', trackId: freePlay.selectedTrack.id }))

  document.addEventListener('fullscreenchange', updateFullscreenState)
  window.addEventListener('resize', updateFullscreenState)
  updateFullscreenState()

  await nextTick()
  updateKeyboardHeight()
  if (freePlayLayoutRef.value) {
    resizeObserver = new ResizeObserver(updateKeyboardHeight)
    resizeObserver.observe(freePlayLayoutRef.value)
  }
})

onBeforeUnmount(() => {
  if (freePlay.status === 'recording') freePlay.stopRecording()
  stopPlayback()
  stopBackingPlayback()
  bindInput(midiAccess, '', () => { })
  unsubscribeNoteInput?.()
  stopTimer()
  closeDialogs()
  player.inputSynth.allNotesOff()
  freePlay.pressedMidiNotes.clear()
  document.removeEventListener('fullscreenchange', updateFullscreenState)
  window.removeEventListener('resize', updateFullscreenState)
  if (resizeObserver) resizeObserver.disconnect()
})

watch(() => settings.keyboardRangeMode, () => {
  player.refreshKeyboardRange()
})

watch(selectedTrackMonitorKey, () => {
  syncMonitorTrack()
})

watch(() => freePlay.selectedTrackId, () => {
  stopBackingPlayback()
})

watch(() => freePlay.status, status => {
  if (status === 'recording') startTimer()
  else stopTimer()
}, { immediate: true })

watch(() => route.query.librarySongId, value => {
  const songId = Array.isArray(value) ? value[0] : value
  if (songId) void importLibrarySongToEditor(songId)
}, { immediate: true })
</script>

<template>
  <main v-if="player.session" ref="freePlayLayoutRef" class="free-play-layout"
    :style="{ '--keyboard-height': `${keyboardHeight}px`, '--black-key-height': `${blackKeyHeight}px` }">
    <FreePlayTopBar :is-fullscreen="isFullscreen" :is-playing="freePlay.isPlaying" :settings-open="showSettingsDialog"
      :metronome-open="showMetronomeDialog" :keyboard-range-open="showKeyboardRangeDialog"
      :labels-open="showLabelsDialog" @start-recording="startRecording" @stop-recording="stopRecording"
      @toggle-playback="togglePlayback" @rewind="freePlay.seekTo(0)" @export-midi="exportMidi"
      @import-midi="importMidiFile" @open-practice="showPracticeDialog = true" @open-track-editor="openTrackEditor"
      @delete-recording="deleteRecording" @open-settings="openSettings" @open-metronome="openMetronome"
      @open-keyboard-range="openKeyboardRange" @open-labels="openLabels" @toggle-fullscreen="toggleFullscreen" />
    <FreePlayProgressBar />
    <section class="free-play-stage" @wheel="handleWheel" @touchstart="handleTouchStart" @touchmove="handleTouchMove"
      @touchend="handleTouchEnd" @touchcancel="handleTouchEnd">
      <FreePlayPianoRoll />
      <FreePlayTrackManager />
    </section>
    <section class="keyboard-shell">
      <PianoKeyboard />
    </section>

    <FreePlayPracticeDialog :show="showPracticeDialog" @close="showPracticeDialog = false"
      @confirm="onPracticeConfirm" />

    <FreePlaySettingsDialog :show="showSettingsDialog" :popup-style="settingsPopupStyle"
      :arrow-style="settingsArrowStyle" :arrow-placement="settingsArrowPlacement" @close="showSettingsDialog = false" />

    <FreePlayMetronomeDialog :show="showMetronomeDialog" :popup-style="metronomePopupStyle"
      :arrow-style="metronomeArrowStyle" :arrow-placement="metronomeArrowPlacement"
      @close="showMetronomeDialog = false" />

    <KeyboardRangeDialog :show="showKeyboardRangeDialog" :popup-style="keyboardRangePopupStyle"
      :arrow-style="keyboardRangeArrowStyle" :arrow-placement="keyboardRangeArrowPlacement"
      @close="showKeyboardRangeDialog = false" />

    <LabelsDialog :show="showLabelsDialog" :popup-style="labelsPopupStyle" :arrow-style="labelsArrowStyle"
      :arrow-placement="labelsArrowPlacement" @close="showLabelsDialog = false" />

    <FreePlayTrackEditorDialog :show="showTrackEditorDialog" @close="showTrackEditorDialog = false" />
  </main>
</template>

<style scoped>
.free-play-layout {
  height: var(--app-viewport-height, 100dvh);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) var(--keyboard-height);
  background: var(--color-bg-tertiary);
  overflow: hidden;
}

.free-play-stage {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.keyboard-shell {
  position: relative;
  height: var(--keyboard-height);
  min-height: 0;
}
</style>
