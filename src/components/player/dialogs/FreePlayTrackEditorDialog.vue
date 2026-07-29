<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirmDialog } from '../../../composables/useConfirmDialog'
import { getEmojiFontFamily, getInstrumentByProgram, getInstrumentEmoji } from '../../../modules/audio/gmInstrumentCatalog'
import { TRACK_SETTINGS_PALETTE } from '../../../modules/game/trackProperties'
import { editorBeatUs } from '../../../modules/freePlay/editor/freePlayTrackEditorGeometry'
import { canPlaceTrackEditorNotes, mutateTrackEditorNotes } from '../../../modules/freePlay/editor/freePlayTrackEditorMutations'
import { FREE_PLAY_EDITOR_SUBDIVISIONS, quarterNoteUs, subdivisionUs, type FreePlayEditorSubdivision } from '../../../modules/freePlay/editor/freePlayTrackEditorSnap'
import { FREE_PLAY_DEFAULT_TRACK_COLOR, MAX_FREE_PLAY_TRACKS, resolveFreePlayUniqueTrackColor, useFreePlayStore, type FreePlayRecordedNote, type FreePlayTrack } from '../../../stores/freePlayStore'
import { usePlayerStore } from '../../../stores/playerStore'
import FreePlayTrackEditorGrid, { type FreePlayTrackEditorMode } from '../FreePlayTrackEditorGrid.vue'
import ColorPickerDialog from './ColorPickerDialog.vue'
import TrackInstrumentDialog from './TrackInstrumentDialog.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { confirm } = useConfirmDialog()
const freePlay = useFreePlayStore()
const player = usePlayerStore()

const gridRef = ref<{ deleteSelected: () => void } | null>(null)
const draftTracks = ref<FreePlayTrack[]>([])
const selectedNoteIds = ref<string[]>([])
const activeTrackId = ref<number | null>(null)
const mode = ref<FreePlayTrackEditorMode>('select')
const snapEnabled = ref(true)
const snapSubdivision = ref<FreePlayEditorSubdivision>('1/16')
type FreePlayEditorQuantizeValue = '1/1' | '1/2' | FreePlayEditorSubdivision

const quantizeSubdivision = ref<FreePlayEditorQuantizeValue>('1/16')
const pixelsPerQuarter = ref(80)
const rowHeight = ref(18)
const editorVolume = ref(72)
const dirty = ref(false)
const mutedTrackIds = ref<number[]>([])
const hiddenTrackIds = ref<number[]>([])
const previewTrackId = ref<number | null>(null)
const editingTrackId = ref<number | null>(null)
const showInstrumentDialog = ref(false)
const showColorDialog = ref(false)
const trackPopupStyle = ref({ top: '0px', left: '0px' })
const trackPopupArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', left: '-7px' })
const trackPopupArrowPlacement = ref<'left' | 'right'>('left')
const playheadUs = ref(0)
const editorPlaying = ref(false)
let previewTimerId: number | null = null
let noteAuditionTimerId: number | null = null
let editorPlaybackTimerId: number | null = null
let editorPlaybackStartedAtMs = 0
let editorPlaybackStartUs = 0
let pastedNoteCounter = 1
const previewActiveVoiceIds = new Set<string>()
const editorPlaybackVoiceIds = new Set<string>()
let noteAuditionVoiceId: string | null = null
const copiedNotes = ref<FreePlayRecordedNote[]>([])
const undoStack = ref<FreePlayTrack[][]>([])
const redoStack = ref<FreePlayTrack[][]>([])
const historyPaused = ref(false)

const selectedCount = computed(() => selectedNoteIds.value.length)
const noteCount = computed(() => draftTracks.value.reduce((total, track) => total + track.notes.length, 0))
const timelineEndUs = computed(() => Math.max(quarterNoteUs(freePlay.bpm) * 16, Math.max(0, ...draftTracks.value.flatMap(track => track.notes.map(note => note.endUs))) + quarterNoteUs(freePlay.bpm) * 4))
const editorBeatDurationUs = computed(() => editorBeatUs(freePlay.bpm, freePlay.timeSignature))
const activeTrack = computed(() => draftTracks.value.find(track => track.id === activeTrackId.value) ?? draftTracks.value[0])
const editingTrack = computed(() => draftTracks.value.find(track => track.id === editingTrackId.value) ?? activeTrack.value ?? draftTracks.value[0])
const selectedNotes = computed(() => draftTracks.value.flatMap(track => track.notes).filter(note => selectedNoteIds.value.includes(note.id)))
const primarySelectedNote = computed(() => selectedNotes.value[0])
const selectionVelocityValue = computed(() => {
  if (!selectedNotes.value.length) return ''
  const firstVelocity = selectedNotes.value[0].velocity
  return selectedNotes.value.every(note => note.velocity === firstVelocity) ? firstVelocity : ''
})
const modeButtons = computed<{ mode: FreePlayTrackEditorMode; label: string; icon: string }[]>(() => [
  { mode: 'select', label: t('freePlay.trackEditorSelectMode'), icon: 'far fa-hand-pointer' },
  { mode: 'draw', label: t('freePlay.trackEditorDrawMode'), icon: 'fas fa-pen' },
  { mode: 'marquee', label: t('freePlay.trackEditorMarqueeMode'), icon: 'far fa-square' },
  { mode: 'erase', label: t('freePlay.trackEditorEraseMode'), icon: 'fas fa-eraser' },
])

const quantizeOptions = computed<{ value: FreePlayEditorQuantizeValue; label: string }[]>(() => [
  { value: '1/1', label: t('freePlay.trackEditorQuantizeWhole') },
  { value: '1/2', label: t('freePlay.trackEditorQuantizeHalf') },
  { value: '1/4', label: t('freePlay.trackEditorQuantizeQuarter') },
  { value: '1/8', label: t('freePlay.trackEditorQuantizeEighth') },
  { value: '1/16', label: t('freePlay.trackEditorQuantizeSixteenth') },
  { value: '1/32', label: t('freePlay.trackEditorQuantizeThirtySecond') },
])

function cloneTracks(tracks: FreePlayTrack[]) {
  return tracks.map(track => ({ ...track, notes: track.notes.map(note => ({ ...note })) }))
}

function resetDraft() {
  stopPreview()
  stopNoteAudition()
  stopEditorPlayback()
  closeTrackDialogs()
  draftTracks.value = cloneTracks(freePlay.tracks)
  selectedNoteIds.value = []
  activeTrackId.value = freePlay.selectedTrackId
  mutedTrackIds.value = []
  hiddenTrackIds.value = []
  playheadUs.value = 0
  editorPlaying.value = false
  undoStack.value = []
  redoStack.value = []
  copiedNotes.value = []
  mode.value = 'select'
  dirty.value = false
}

function pushHistorySnapshot() {
  if (historyPaused.value) return
  undoStack.value = [...undoStack.value.slice(-49), cloneTracks(draftTracks.value)]
  redoStack.value = []
}

function commitDraftTracks(tracks: FreePlayTrack[], markAsDirty = true) {
  if (markAsDirty) pushHistorySnapshot()
  draftTracks.value = tracks
  playheadUs.value = Math.min(playheadUs.value, timelineEndUs.value)
  if (markAsDirty) dirty.value = true
}

function markDirty() {
  dirty.value = true
}

function updateDraftTracks(tracks: FreePlayTrack[]) {
  commitDraftTracks(tracks)
}

function deleteSelection() {
  gridRef.value?.deleteSelected()
}

function selectAllVisibleNotes() {
  const hidden = new Set(hiddenTrackIds.value)
  selectedNoteIds.value = draftTracks.value
    .filter(track => !hidden.has(track.id))
    .flatMap(track => track.notes.map(note => note.id))
}

function displayTrackName(track: FreePlayTrack, index: number) {
  const customName = track.name.trim()
  if (customName) return customName
  return t('freePlay.trackNumber', { number: index + 1 })
}

function calculateTrackPopupPosition(element: HTMLElement, width: number, height: number) {
  const rect = element.getBoundingClientRect()
  const margin = 10
  const gap = 10
  let left = rect.right + gap
  let top = rect.top + rect.height / 2 - height / 2
  let placement: 'left' | 'right' = 'left'

  if (left + width > window.innerWidth - margin) {
    left = rect.left - width - gap
    placement = 'right'
  }
  if (left < margin) left = margin
  if (top < margin) top = margin
  if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - height - margin)

  const arrowTop = Math.max(16, Math.min(height - 16, rect.top + rect.height / 2 - top))
  return {
    popupStyle: { top: `${top}px`, left: `${left}px` },
    arrowStyle: placement === 'left' ? { top: `${arrowTop}px`, left: '-7px' } : { top: `${arrowTop}px`, right: '-7px' },
    arrowPlacement: placement,
  }
}

function closeTrackDialogs() {
  showInstrumentDialog.value = false
  showColorDialog.value = false
  editingTrackId.value = null
}

function openTrackInstrument(track: FreePlayTrack, event: MouseEvent) {
  event.stopPropagation()
  activeTrackId.value = track.id
  editingTrackId.value = track.id
  const position = calculateTrackPopupPosition(event.currentTarget as HTMLElement, 500, 520)
  trackPopupStyle.value = position.popupStyle
  trackPopupArrowStyle.value = position.arrowStyle
  trackPopupArrowPlacement.value = position.arrowPlacement
  showColorDialog.value = false
  showInstrumentDialog.value = true
}

function openTrackColor(track: FreePlayTrack, event: MouseEvent) {
  event.stopPropagation()
  activeTrackId.value = track.id
  editingTrackId.value = track.id
  const position = calculateTrackPopupPosition(event.currentTarget as HTMLElement, 80, 360)
  trackPopupStyle.value = position.popupStyle
  trackPopupArrowStyle.value = position.arrowStyle
  trackPopupArrowPlacement.value = position.arrowPlacement
  showInstrumentDialog.value = false
  showColorDialog.value = true
}

function selectTrackInstrument(program: number) {
  if (editingTrackId.value == null) return
  updateTrack(editingTrackId.value, track => { track.instrumentProgram = program })
}

function selectTrackColor(color: string) {
  if (editingTrackId.value == null) return
  const editingId = editingTrackId.value
  const fallbackIndex = draftTracks.value.findIndex(track => track.id === editingId)
  updateTrack(editingId, track => {
    track.color = resolveFreePlayUniqueTrackColor(color, draftTracks.value, editingId, Math.max(0, fallbackIndex))
  })
}

function sortTrackNotes(track: FreePlayTrack) {
  track.notes.sort((left, right) => left.startUs - right.startUs || left.noteId - right.noteId || left.endUs - right.endUs)
}

function updateTrack(trackId: number, updater: (track: FreePlayTrack) => void) {
  const tracks = cloneTracks(draftTracks.value)
  const track = tracks.find(track => track.id === trackId)
  if (!track) return
  updater(track)
  commitDraftTracks(tracks)
}

function addDraftTrack() {
  if (draftTracks.value.length >= MAX_FREE_PLAY_TRACKS) return
  const nextId = Math.max(0, ...draftTracks.value.map(track => track.id)) + 1
  const color = resolveFreePlayUniqueTrackColor(
    TRACK_SETTINGS_PALETTE[draftTracks.value.length % TRACK_SETTINGS_PALETTE.length] ?? FREE_PLAY_DEFAULT_TRACK_COLOR,
    draftTracks.value,
    nextId,
    draftTracks.value.length,
  )
  commitDraftTracks([...draftTracks.value, { id: nextId, name: '', instrumentProgram: 0, color, loop: false, notes: [] }])
  activeTrackId.value = nextId
}

async function clearDraftTrack(trackId: number) {
  const track = draftTracks.value.find(track => track.id === trackId)
  if (!track) return
  const confirmed = await confirm({
    title: t('freePlay.clearTrackConfirmTitle'),
    message: t('freePlay.clearTrackConfirmMessage', { track: displayTrackName(track, draftTracks.value.indexOf(track)) }),
    confirmLabel: t('common.clear'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
  if (!confirmed) return
  updateTrack(trackId, track => { track.notes = [] })
  selectedNoteIds.value = selectedNoteIds.value.filter(id => draftTracks.value.some(track => track.notes.some(note => note.id === id)))
}

async function deleteDraftTrack(trackId: number) {
  const track = draftTracks.value.find(track => track.id === trackId)
  if (!track) return
  const confirmed = await confirm({
    title: t('freePlay.deleteTrackConfirmTitle'),
    message: t('freePlay.deleteTrackConfirmMessage', { track: displayTrackName(track, draftTracks.value.indexOf(track)) }),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
  if (!confirmed) return
  if (draftTracks.value.length === 1) {
    updateTrack(trackId, track => {
      track.name = ''
      track.instrumentProgram = 0
      track.loop = false
      track.notes = []
    })
    return
  }
  const tracks = draftTracks.value.filter(track => track.id !== trackId)
  commitDraftTracks(tracks)
  mutedTrackIds.value = mutedTrackIds.value.filter(id => id !== trackId)
  selectedNoteIds.value = selectedNoteIds.value.filter(id => tracks.some(track => track.notes.some(note => note.id === id)))
  if (activeTrackId.value === trackId) activeTrackId.value = tracks[0]?.id ?? null
  if (previewTrackId.value === trackId) stopPreview()
}

function toggleMutedTrack(trackId: number) {
  mutedTrackIds.value = mutedTrackIds.value.includes(trackId)
    ? mutedTrackIds.value.filter(id => id !== trackId)
    : [...mutedTrackIds.value, trackId]
  if (mutedTrackIds.value.includes(trackId) && previewTrackId.value === trackId) stopPreview()
}

function toggleHiddenTrack(trackId: number) {
  hiddenTrackIds.value = hiddenTrackIds.value.includes(trackId)
    ? hiddenTrackIds.value.filter(id => id !== trackId)
    : [...hiddenTrackIds.value, trackId]
  selectedNoteIds.value = selectedNoteIds.value.filter(id => !hiddenTrackIds.value.includes(noteTrackId(id)))
}

function noteTrackId(noteId: string) {
  return draftTracks.value.find(track => track.notes.some(note => note.id === noteId))?.id ?? -1
}

function stopPreview() {
  if (previewTimerId !== null) {
    window.clearInterval(previewTimerId)
    previewTimerId = null
  }
  for (const voiceId of previewActiveVoiceIds) player.inputSynth.noteOff(voiceId)
  previewActiveVoiceIds.clear()
  previewTrackId.value = null
}

function stopNoteAudition() {
  if (noteAuditionTimerId !== null) {
    window.clearTimeout(noteAuditionTimerId)
    noteAuditionTimerId = null
  }
  if (!noteAuditionVoiceId) return
  player.inputSynth.noteOff(noteAuditionVoiceId)
  noteAuditionVoiceId = null
}

async function auditionNote(note: FreePlayRecordedNote) {
  const track = draftTracks.value.find(track => track.id === note.trackId)
  if (!track || mutedTrackIds.value.includes(track.id)) return
  stopNoteAudition()
  const voiceId = `free-play-editor-audition:${track.id}:${note.id}`
  noteAuditionVoiceId = voiceId
  const soundfontId = getInstrumentByProgram(track.instrumentProgram).soundfontId
  await player.inputSynth.start()
  if (noteAuditionVoiceId !== voiceId) return
  void player.inputSynth.noteOn(voiceId, note.noteId, note.velocity, soundfontId)
  noteAuditionTimerId = window.setTimeout(stopNoteAudition, 380)
}

function editorPlaybackVoiceId(trackId: number, noteId: string) {
  return `free-play-editor-playback:${trackId}:${noteId}`
}

function stopEditorPlaybackVoices() {
  for (const voiceId of editorPlaybackVoiceIds) player.inputSynth.noteOff(voiceId)
  editorPlaybackVoiceIds.clear()
}

function tickEditorPlayback() {
  const elapsedUs = Math.round((performance.now() - editorPlaybackStartedAtMs) * 1000)
  playheadUs.value = Math.min(timelineEndUs.value, editorPlaybackStartUs + elapsedUs)
  const active = new Set<string>()

  for (const track of draftTracks.value) {
    if (mutedTrackIds.value.includes(track.id)) continue
    const soundfontId = getInstrumentByProgram(track.instrumentProgram).soundfontId
    for (const note of track.notes) {
      if (note.startUs > playheadUs.value || note.endUs <= playheadUs.value) continue
      const voiceId = editorPlaybackVoiceId(track.id, note.id)
      active.add(voiceId)
      if (editorPlaybackVoiceIds.has(voiceId)) continue
      editorPlaybackVoiceIds.add(voiceId)
      void player.inputSynth.noteOn(voiceId, note.noteId, note.velocity, soundfontId)
    }
  }

  for (const voiceId of [...editorPlaybackVoiceIds]) {
    if (active.has(voiceId)) continue
    player.inputSynth.noteOff(voiceId)
    editorPlaybackVoiceIds.delete(voiceId)
  }

  if (playheadUs.value >= timelineEndUs.value) stopEditorPlayback(false)
}

function startEditorPlayback() {
  stopPreview()
  stopEditorPlaybackVoices()
  editorPlaybackStartUs = playheadUs.value >= timelineEndUs.value ? 0 : playheadUs.value
  playheadUs.value = editorPlaybackStartUs
  editorPlaybackStartedAtMs = performance.now()
  editorPlaying.value = true
  tickEditorPlayback()
  editorPlaybackTimerId = window.setInterval(tickEditorPlayback, 30)
}

function stopEditorPlayback(keepPosition = true) {
  if (editorPlaybackTimerId !== null) {
    window.clearInterval(editorPlaybackTimerId)
    editorPlaybackTimerId = null
  }
  stopEditorPlaybackVoices()
  editorPlaying.value = false
  if (!keepPosition && playheadUs.value >= timelineEndUs.value) playheadUs.value = timelineEndUs.value
}

function toggleEditorPlayback() {
  if (editorPlaying.value) stopEditorPlayback()
  else startEditorPlayback()
}

function seekEditorPlayback(nextUs: number) {
  playheadUs.value = Math.max(0, Math.min(timelineEndUs.value, Math.round(nextUs)))
  if (!editorPlaying.value) return
  stopEditorPlaybackVoices()
  editorPlaybackStartUs = playheadUs.value
  editorPlaybackStartedAtMs = performance.now()
}

function seekToStart() {
  seekEditorPlayback(0)
}

function seekToEnd() {
  seekEditorPlayback(timelineEndUs.value)
}

function seekByBeat(direction: -1 | 1) {
  seekEditorPlayback(playheadUs.value + editorBeatDurationUs.value * direction)
}

function startPreview(trackId: number) {
  if (mutedTrackIds.value.includes(trackId)) return
  const track = draftTracks.value.find(track => track.id === trackId)
  if (!track?.notes.length) return
  stopPreview()
  previewTrackId.value = trackId
  const startedAt = performance.now()
  const durationUs = Math.max(...track.notes.map(note => note.endUs))
  const soundfontId = getInstrumentByProgram(track.instrumentProgram).soundfontId
  previewTimerId = window.setInterval(() => {
    const elapsedUs = Math.round((performance.now() - startedAt) * 1000)
    const active = new Set<string>()
    for (const note of track.notes) {
      if (note.startUs > elapsedUs || note.endUs <= elapsedUs) continue
      const voiceId = `free-play-editor-preview:${track.id}:${note.id}`
      active.add(voiceId)
      if (previewActiveVoiceIds.has(voiceId)) continue
      previewActiveVoiceIds.add(voiceId)
      void player.inputSynth.noteOn(voiceId, note.noteId, note.velocity, soundfontId)
    }
    for (const voiceId of [...previewActiveVoiceIds]) {
      if (active.has(voiceId)) continue
      player.inputSynth.noteOff(voiceId)
      previewActiveVoiceIds.delete(voiceId)
    }
    if (elapsedUs > durationUs + 150_000) stopPreview()
  }, 30)
}

function togglePreview(trackId: number) {
  if (previewTrackId.value === trackId) stopPreview()
  else startPreview(trackId)
}

function moveSelectionToTrack(trackId: number) {
  updateSelectedNotes(note => { note.trackId = trackId })
  if (!selectedNoteIds.value.length) return
  activeTrackId.value = trackId
}

function updateSelectedNotes(updater: (note: FreePlayRecordedNote) => void) {
  if (!selectedNoteIds.value.length) return
  const tracks = mutateTrackEditorNotes(draftTracks.value, selectedNoteIds.value, updater)
  if (!tracks) return
  commitDraftTracks(tracks)
}

function updatePrimarySelectedNote(updater: (note: FreePlayRecordedNote) => void) {
  const noteId = primarySelectedNote.value?.id
  if (!noteId) return
  const previousSelection = [...selectedNoteIds.value]
  selectedNoteIds.value = [noteId]
  updateSelectedNotes(updater)
  selectedNoteIds.value = previousSelection
}

function setSelectedTrack(trackId: number) {
  moveSelectionToTrack(trackId)
}

function setSelectedVelocity(value: number | string) {
  if (value === '') return
  updateSelectedNotes(note => { note.velocity = Number(value) })
}

function quantizeUnitUs(value = quantizeSubdivision.value) {
  if (value === '1/1') return quarterNoteUs(freePlay.bpm) * 4
  if (value === '1/2') return quarterNoteUs(freePlay.bpm) * 2
  return subdivisionUs(freePlay.bpm, value)
}

function quantizeTimeUs(timeUs: number, unitUs = quantizeUnitUs()) {
  return Math.max(0, Math.round(Math.round(timeUs / unitUs) * unitUs))
}

async function quantizeNotes() {
  const quantizeAll = !selectedNoteIds.value.length
  const targetIds = quantizeAll
    ? draftTracks.value.flatMap(track => track.notes.map(note => note.id))
    : [...selectedNoteIds.value]
  if (!targetIds.length) return

  if (quantizeAll) {
    const confirmed = await confirm({
      title: t('freePlay.trackEditorQuantizeAllConfirmTitle'),
      message: t('freePlay.trackEditorQuantizeAllConfirmMessage'),
      confirmLabel: t('common.continue'),
      cancelLabel: t('common.cancel'),
      tone: 'primary',
    })
    if (!confirmed) return
  }

  const unitUs = quantizeUnitUs()
  if (quantizeAll) {
    const tracks = cloneTracks(draftTracks.value)
    for (const track of tracks) {
      for (const note of track.notes) {
        const startUs = quantizeTimeUs(note.startUs, unitUs)
        note.startUs = startUs
        note.endUs = Math.max(startUs + unitUs, quantizeTimeUs(note.endUs, unitUs))
      }
      sortTrackNotes(track)
    }
    commitDraftTracks(tracks)
    selectedNoteIds.value = targetIds
    return
  }

  const tracks = mutateTrackEditorNotes(draftTracks.value, targetIds, note => {
    const startUs = quantizeTimeUs(note.startUs, unitUs)
    const endUs = Math.max(startUs + unitUs, quantizeTimeUs(note.endUs, unitUs))
    return { startUs, endUs }
  })
  if (!tracks) return
  commitDraftTracks(tracks)
  selectedNoteIds.value = targetIds
}

function copySelectedNotes() {
  if (!selectedNotes.value.length) return
  copiedNotes.value = selectedNotes.value
    .map(note => ({ ...note }))
    .sort((left, right) => left.startUs - right.startUs || left.noteId - right.noteId)
}

function pasteCopiedNotes() {
  if (!copiedNotes.value.length) return
  const tracks = cloneTracks(draftTracks.value)
  const trackIds = new Set(tracks.map(track => track.id))
  const fallbackTrackId = activeTrack.value?.id ?? tracks[0]?.id ?? 1
  const earliestStartUs = Math.min(...copiedNotes.value.map(note => note.startUs))
  const proposals = copiedNotes.value.map(note => {
    const startUs = Math.max(0, Math.round(playheadUs.value + note.startUs - earliestStartUs))
    return {
      ...note,
      id: `paste:${Date.now?.() ?? performance.now()}:${pastedNoteCounter++}`,
      trackId: trackIds.has(note.trackId) ? note.trackId : fallbackTrackId,
      startUs,
      endUs: startUs + Math.max(10_000, note.endUs - note.startUs),
    }
  })
  if (!canPlaceTrackEditorNotes(tracks, proposals)) return
  for (const note of proposals) {
    const track = tracks.find(track => track.id === note.trackId)
    if (track) track.notes.push(note)
  }
  for (const track of tracks) sortTrackNotes(track)
  commitDraftTracks(tracks)
  selectedNoteIds.value = proposals.map(note => note.id)
}

function undoEditorChange() {
  const previous = undoStack.value[undoStack.value.length - 1]
  if (!previous) return
  redoStack.value = [...redoStack.value, cloneTracks(draftTracks.value)]
  undoStack.value = undoStack.value.slice(0, -1)
  draftTracks.value = cloneTracks(previous)
  selectedNoteIds.value = selectedNoteIds.value.filter(id => draftTracks.value.some(track => track.notes.some(note => note.id === id)))
  dirty.value = true
}

function redoEditorChange() {
  const next = redoStack.value[redoStack.value.length - 1]
  if (!next) return
  undoStack.value = [...undoStack.value, cloneTracks(draftTracks.value)]
  redoStack.value = redoStack.value.slice(0, -1)
  draftTracks.value = cloneTracks(next)
  selectedNoteIds.value = selectedNoteIds.value.filter(id => draftTracks.value.some(track => track.notes.some(note => note.id === id)))
  dirty.value = true
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
}

function shiftSelectedStart(value: number | string) {
  if (value === '' || !selectedNotes.value.length) return
  const nextStartUs = Number(value) * 1000
  const earliestStartUs = Math.min(...selectedNotes.value.map(note => note.startUs))
  const deltaUs = nextStartUs - earliestStartUs
  updateSelectedNotes(note => {
    note.startUs += deltaUs
    note.endUs += deltaUs
  })
}

function shiftSelectedEnd(value: number | string) {
  if (value === '' || !selectedNotes.value.length) return
  const nextEndUs = Number(value) * 1000
  const latestEndUs = Math.max(...selectedNotes.value.map(note => note.endUs))
  const deltaUs = nextEndUs - latestEndUs
  updateSelectedNotes(note => {
    note.startUs += deltaUs
    note.endUs += deltaUs
  })
}

function setSelectedDuration(value: number | string) {
  if (value === '') return
  const durationUs = Number(value) * 1000
  updateSelectedNotes(note => { note.endUs = note.startUs + durationUs })
}

function transposeSelectedToPitch(value: number | string) {
  if (value === '' || !primarySelectedNote.value) return
  const delta = Number(value) - primarySelectedNote.value.noteId
  updateSelectedNotes(note => { note.noteId += delta })
}

function zoomIn() {
  pixelsPerQuarter.value = Math.min(220, pixelsPerQuarter.value + 16)
}

function zoomOut() {
  pixelsPerQuarter.value = Math.max(32, pixelsPerQuarter.value - 16)
}

async function requestClose() {
  if (!dirty.value) {
    emit('close')
    return
  }
  const confirmed = await confirm({
    title: t('freePlay.trackEditorDiscardTitle'),
    message: t('freePlay.trackEditorDiscardMessage'),
    confirmLabel: t('freePlay.trackEditorDiscardConfirm'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
  if (confirmed) {
    stopPreview()
    stopNoteAudition()
    stopEditorPlayback()
    closeTrackDialogs()
    emit('close')
  }
}

function save() {
  stopPreview()
  stopNoteAudition()
  stopEditorPlayback()
  closeTrackDialogs()
  freePlay.commitTrackEditorDraft(draftTracks.value, activeTrackId.value)
  dirty.value = false
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.show) return
  const modifierPressed = event.ctrlKey || event.metaKey

  if (modifierPressed && !isEditableTarget(event.target)) {
    const key = event.key.toLowerCase()
    if (key === 'a') {
      event.preventDefault()
      selectAllVisibleNotes()
      return
    }
    if (key === 'c') {
      event.preventDefault()
      copySelectedNotes()
      return
    }
    if (key === 'v') {
      event.preventDefault()
      pasteCopiedNotes()
      return
    }
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) redoEditorChange()
      else undoEditorChange()
      return
    }
    if (key === 'y') {
      event.preventDefault()
      redoEditorChange()
      return
    }
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (!selectedNoteIds.value.length || isEditableTarget(event.target)) return
    event.preventDefault()
    deleteSelection()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    if (selectedNoteIds.value.length) {
      selectedNoteIds.value = []
      return
    }
    void requestClose()
  }
}

watch(() => props.show, async show => {
  if (!show) {
    stopPreview()
    stopNoteAudition()
    stopEditorPlayback()
    closeTrackDialogs()
    return
  }
  player.inputSynth.setMasterVolume(editorVolume.value / 100)
  resetDraft()
  await nextTick()
}, { immediate: true })

watch(editorVolume, value => {
  player.inputSynth.setMasterVolume(value / 100)
})

onBeforeUnmount(() => {
  stopPreview()
  stopNoteAudition()
  stopEditorPlayback()
  closeTrackDialogs()
})
</script>

<template>
  <Transition name="track-editor">
    <div
      v-if="show"
      class="track-editor-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('freePlay.trackEditorTitle')"
      tabindex="-1"
      @keydown="handleKeydown"
    >
      <section class="track-editor-shell">
        <header class="track-editor-header">
          <span class="editor-brand-icon" :title="t('freePlay.trackEditorTitle')" :aria-label="t('freePlay.trackEditorTitle')">🎹</span>

          <div class="primary-actions">
            <button class="action-button primary action-button--icon" :title="t('common.save')" :aria-label="t('common.save')" @click="save">
              <i class="fas fa-save"></i>
            </button>
            <button class="action-button secondary action-button--icon" :title="t('common.cancel')" :aria-label="t('common.cancel')" @click="requestClose">
              <i class="fas fa-ban"></i>
            </button>
          </div>

          <div class="editor-toolbar" :aria-label="t('freePlay.trackEditorToolbar')">
            <div class="tool-group playback-group">
              <button class="tool-button" :title="t('freePlay.trackEditorGoToStart')" :aria-label="t('freePlay.trackEditorGoToStart')" @click="seekToStart">
                <i class="fas fa-backward-fast"></i>
              </button>
              <button class="tool-button" :title="t('freePlay.trackEditorPreviousBeat')" :aria-label="t('freePlay.trackEditorPreviousBeat')" @click="seekByBeat(-1)">
                <i class="fas fa-backward-step"></i>
              </button>
              <button class="tool-button" :class="{ active: editorPlaying }" :title="editorPlaying ? t('freePlay.trackEditorStopPlayback') : t('freePlay.trackEditorPlay')" :aria-label="editorPlaying ? t('freePlay.trackEditorStopPlayback') : t('freePlay.trackEditorPlay')" @click="toggleEditorPlayback">
                <i :class="editorPlaying ? 'fas fa-stop' : 'fas fa-play'"></i>
              </button>
              <button class="tool-button" :title="t('freePlay.trackEditorNextBeat')" :aria-label="t('freePlay.trackEditorNextBeat')" @click="seekByBeat(1)">
                <i class="fas fa-forward-step"></i>
              </button>
              <button class="tool-button" :title="t('freePlay.trackEditorGoToEnd')" :aria-label="t('freePlay.trackEditorGoToEnd')" @click="seekToEnd">
                <i class="fas fa-forward-fast"></i>
              </button>
            </div>

            <div class="tool-group">
              <button class="tool-button" :disabled="!undoStack.length" :title="t('freePlay.trackEditorUndo')" :aria-label="t('freePlay.trackEditorUndo')" @click="undoEditorChange">
                <i class="fas fa-rotate-left"></i>
              </button>
              <button class="tool-button" :disabled="!redoStack.length" :title="t('freePlay.trackEditorRedo')" :aria-label="t('freePlay.trackEditorRedo')" @click="redoEditorChange">
                <i class="fas fa-rotate-right"></i>
              </button>
              <button class="tool-button" :disabled="!selectedCount" :title="t('freePlay.trackEditorCopy')" :aria-label="t('freePlay.trackEditorCopy')" @click="copySelectedNotes">
                <i class="fas fa-copy"></i>
              </button>
              <button class="tool-button" :disabled="!copiedNotes.length" :title="t('freePlay.trackEditorPaste')" :aria-label="t('freePlay.trackEditorPaste')" @click="pasteCopiedNotes">
                <i class="fas fa-paste"></i>
              </button>
            </div>

            <div class="tool-group">
              <button
                v-for="button in modeButtons"
                :key="button.mode"
                class="tool-button"
                :class="{ active: mode === button.mode }"
                :title="button.label"
                :aria-label="button.label"
                :aria-pressed="mode === button.mode"
                @click="mode = button.mode"
              >
                <i :class="button.icon"></i>
              </button>
            </div>

            <div class="tool-group snap-group">
              <button
                class="tool-button"
                :class="{ active: snapEnabled }"
                :aria-pressed="snapEnabled"
                :title="snapEnabled ? t('freePlay.trackEditorSnapOn') : t('freePlay.trackEditorSnapOff')"
                :aria-label="snapEnabled ? t('freePlay.trackEditorSnapOn') : t('freePlay.trackEditorSnapOff')"
                @click="snapEnabled = !snapEnabled"
              >
                <i class="fas fa-magnet"></i>
              </button>
              <label class="select-label">
                <span>{{ t('freePlay.trackEditorSubdivision') }}</span>
                <select v-model="snapSubdivision" class="subdivision-select">
                  <option v-for="option in FREE_PLAY_EDITOR_SUBDIVISIONS" :key="option" :value="option">{{ option }}</option>
                </select>
              </label>
            </div>

            <div class="tool-group volume-group">
              <i class="fas fa-volume-high volume-icon"></i>
              <input
                v-model.number="editorVolume"
                class="volume-slider"
                type="range"
                min="0"
                max="150"
                step="1"
                :title="`${t('settings.volume')}: ${editorVolume}%`"
                :aria-label="t('settings.volume')"
              />
            </div>

            <div class="tool-group quantize-group" role="radiogroup" :aria-label="t('freePlay.trackEditorQuantizeGrid')">
              <button
                v-for="option in quantizeOptions"
                :key="option.value"
                class="tool-button quantize-option"
                :class="{ active: quantizeSubdivision === option.value }"
                :aria-pressed="quantizeSubdivision === option.value"
                :title="option.label"
                :aria-label="option.label"
                @click="quantizeSubdivision = option.value"
              >
                {{ option.value }}
              </button>
              <button class="tool-button" :title="t('freePlay.trackEditorQuantize')" :aria-label="t('freePlay.trackEditorQuantize')" @click="quantizeNotes">
                <i class="fas fa-align-left"></i>
              </button>
            </div>

            <div class="tool-group">
              <button class="tool-button" :title="t('freePlay.trackEditorZoomOut')" :aria-label="t('freePlay.trackEditorZoomOut')" @click="zoomOut">
                <i class="fas fa-search-minus"></i>
              </button>
              <button class="tool-button" :title="t('freePlay.trackEditorZoomIn')" :aria-label="t('freePlay.trackEditorZoomIn')" @click="zoomIn">
                <i class="fas fa-search-plus"></i>
              </button>
              <button
                class="tool-button danger"
                :disabled="!selectedCount"
                :title="t('freePlay.trackEditorDeleteSelection')"
                :aria-label="t('freePlay.trackEditorDeleteSelection')"
                @click="deleteSelection"
              >
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>

          <div class="dialog-actions">
            <button class="close-button" :aria-label="t('common.close')" @click="requestClose">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
        </header>

        <main class="track-editor-body track-editor-body--split">
          <section class="editor-workspace-shell">
            <div v-if="!noteCount" class="empty-state">{{ t('freePlay.trackEditorEmptyState') }}</div>
            <FreePlayTrackEditorGrid
              ref="gridRef"
              :tracks="draftTracks"
              :bpm="freePlay.bpm"
              :time-signature="freePlay.timeSignature"
              :mode="mode"
              :snap-enabled="snapEnabled"
              :snap-subdivision="snapSubdivision"
              :selected-note-ids="selectedNoteIds"
              :active-track-id="activeTrack?.id ?? null"
              :muted-track-ids="mutedTrackIds"
              :hidden-track-ids="hiddenTrackIds"
              :velocity-label="t('freePlay.trackEditorVelocity')"
              :pixels-per-quarter="pixelsPerQuarter"
              :row-height="rowHeight"
              :playhead-us="playheadUs"
              :follow-playhead="editorPlaying"
              @update:tracks="updateDraftTracks"
              @update:selected-note-ids="selectedNoteIds = $event"
              @preview-note="auditionNote"
              @seek="seekEditorPlayback"
              @dirty="markDirty"
            />
          </section>

          <aside class="editor-side-stack">
            <section class="editor-side-panel track-panel" :aria-label="t('freePlay.trackEditorTrackPanel')">
            <div class="panel-header">
              <h3>{{ t('freePlay.trackEditorTrackPanel') }}</h3>
              <button v-if="draftTracks.length < MAX_FREE_PLAY_TRACKS" class="panel-icon-button" :title="t('freePlay.addTrack')" :aria-label="t('freePlay.addTrack')" @click="addDraftTrack">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <div class="track-card-list">
              <article
                v-for="(track, index) in draftTracks"
                :key="track.id"
                class="editor-track-card"
                :class="{ active: activeTrack?.id === track.id, muted: mutedTrackIds.includes(track.id) }"
                @click="activeTrackId = track.id"
              >
                <button
                  class="track-instrument-button"
                  :title="t('freePlay.selectTrackInstrument')"
                  :aria-label="t('freePlay.selectTrackInstrument')"
                  @click.stop="openTrackInstrument(track, $event)"
                >
                  <span class="track-instrument-emoji" :style="{ fontFamily: getEmojiFontFamily() }">{{ getInstrumentEmoji(getInstrumentByProgram(track.instrumentProgram)) }}</span>
                </button>
                <div class="track-card-content">
                  <input
                    class="track-name-input"
                    :value="track.name || displayTrackName(track, index)"
                    :aria-label="t('freePlay.trackEditorTrackName')"
                    @input="updateTrack(track.id, item => { item.name = ($event.target as HTMLInputElement).value })"
                    @click.stop
                  />
                  <div class="track-card-meta">{{ getInstrumentByProgram(track.instrumentProgram).name }} · {{ t('trackSettings.notes', { count: track.notes.length }) }}</div>
                  <div class="track-card-controls">
                    <button
                      class="track-color-button"
                      :style="{ backgroundColor: track.color }"
                      :title="t('freePlay.selectTrackColor')"
                      :aria-label="t('freePlay.selectTrackColor')"
                      @click.stop="openTrackColor(track, $event)"
                    ></button>
                    <button class="panel-icon-button" :class="{ active: !hiddenTrackIds.includes(track.id) }" :title="hiddenTrackIds.includes(track.id) ? t('freePlay.trackEditorShowTrackEvents') : t('freePlay.trackEditorHideTrackEvents')" :aria-label="hiddenTrackIds.includes(track.id) ? t('freePlay.trackEditorShowTrackEvents') : t('freePlay.trackEditorHideTrackEvents')" @click.stop="toggleHiddenTrack(track.id)">
                      <i :class="hiddenTrackIds.includes(track.id) ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                    </button>
                    <button class="panel-icon-button" :class="{ active: previewTrackId === track.id }" :disabled="mutedTrackIds.includes(track.id) || !track.notes.length" :title="previewTrackId === track.id ? t('freePlay.trackEditorStopPreview') : t('freePlay.trackEditorPreviewTrack')" :aria-label="previewTrackId === track.id ? t('freePlay.trackEditorStopPreview') : t('freePlay.trackEditorPreviewTrack')" @click.stop="togglePreview(track.id)">
                      <i :class="previewTrackId === track.id ? 'fas fa-stop' : 'fas fa-play'"></i>
                    </button>
                    <button class="panel-icon-button" :class="{ active: mutedTrackIds.includes(track.id) }" :title="mutedTrackIds.includes(track.id) ? t('freePlay.trackEditorUnmuteTrack') : t('freePlay.trackEditorMuteTrack')" :aria-label="mutedTrackIds.includes(track.id) ? t('freePlay.trackEditorUnmuteTrack') : t('freePlay.trackEditorMuteTrack')" @click.stop="toggleMutedTrack(track.id)">
                      <i :class="mutedTrackIds.includes(track.id) ? 'fas fa-volume-xmark' : 'fas fa-volume-high'"></i>
                    </button>
                    <button class="panel-icon-button" :class="{ active: track.loop }" :title="t('freePlay.loopTrack')" :aria-label="t('freePlay.loopTrack')" @click.stop="updateTrack(track.id, item => { item.loop = !item.loop })">
                      <i class="fas fa-repeat"></i>
                    </button>
                    <button class="panel-icon-button danger" :title="t('freePlay.clearTrack')" :aria-label="t('freePlay.clearTrack')" @click.stop="clearDraftTrack(track.id)">
                      <i class="fas fa-eraser"></i>
                    </button>
                    <button class="panel-icon-button danger" :title="t('freePlay.deleteTrack')" :aria-label="t('freePlay.deleteTrack')" @click.stop="deleteDraftTrack(track.id)">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              </article>
            </div>
            </section>

            <section class="editor-side-panel inspector-panel" :aria-label="t('freePlay.trackEditorEventProperties')">
              <div class="panel-header">
                <h3>{{ t('freePlay.trackEditorEventProperties') }}</h3>
              </div>
              <div v-if="!selectedCount" class="inspector-empty">{{ t('freePlay.trackEditorNoSelection') }}</div>
              <div v-else class="inspector-form">
                <div class="selection-summary">{{ selectedCount === 1 ? t('freePlay.trackEditorSelectedCount', { count: selectedCount }) : t('freePlay.trackEditorMultiSelection', { count: selectedCount }) }}</div>
                <label class="inspector-field">
                  <span>{{ t('freePlay.trackEditorTrack') }}</span>
                  <select :value="primarySelectedNote?.trackId ?? activeTrack?.id" @change="setSelectedTrack(Number(($event.target as HTMLSelectElement).value))">
                    <option v-for="(track, index) in draftTracks" :key="track.id" :value="track.id">{{ displayTrackName(track, index) }}</option>
                  </select>
                </label>
                <label class="inspector-field">
                  <span>{{ t('freePlay.trackEditorPitch') }}</span>
                  <input type="number" min="0" max="127" :value="primarySelectedNote?.noteId ?? ''" @change="transposeSelectedToPitch(($event.target as HTMLInputElement).value)" />
                </label>
                <label class="inspector-field">
                  <span>{{ t('freePlay.trackEditorStart') }}</span>
                  <input type="number" min="0" step="1" :value="primarySelectedNote ? Math.round(primarySelectedNote.startUs / 1000) : ''" @change="selectedCount === 1 ? updatePrimarySelectedNote(note => { note.startUs = Number(($event.target as HTMLInputElement).value) * 1000 }) : shiftSelectedStart(($event.target as HTMLInputElement).value)" />
                </label>
                <label class="inspector-field">
                  <span>{{ t('freePlay.trackEditorEnd') }}</span>
                  <input type="number" min="0" step="1" :value="primarySelectedNote ? Math.round(primarySelectedNote.endUs / 1000) : ''" @change="selectedCount === 1 ? updatePrimarySelectedNote(note => { note.endUs = Number(($event.target as HTMLInputElement).value) * 1000 }) : shiftSelectedEnd(($event.target as HTMLInputElement).value)" />
                </label>
                <label class="inspector-field">
                  <span>{{ t('freePlay.trackEditorDuration') }}</span>
                  <input type="number" min="10" step="1" :value="primarySelectedNote ? Math.round((primarySelectedNote.endUs - primarySelectedNote.startUs) / 1000) : ''" @change="setSelectedDuration(($event.target as HTMLInputElement).value)" />
                </label>
                <label class="inspector-field">
                  <span>{{ t('freePlay.trackEditorVelocity') }}</span>
                  <input type="number" min="1" max="127" :placeholder="t('freePlay.trackEditorMixedValue')" :value="selectionVelocityValue" @change="setSelectedVelocity(($event.target as HTMLInputElement).value)" />
                </label>
              </div>
            </section>
          </aside>
        </main>

        <TrackInstrumentDialog
          :show="showInstrumentDialog"
          :current-program="editingTrack?.instrumentProgram ?? 0"
          :popup-style="trackPopupStyle"
          :arrow-style="trackPopupArrowStyle"
          :arrow-placement="trackPopupArrowPlacement"
          @select="selectTrackInstrument"
          @close="closeTrackDialogs"
        />

        <ColorPickerDialog
          :show="showColorDialog"
          :current-color="editingTrack?.color ?? ''"
          :popup-style="trackPopupStyle"
          :arrow-style="trackPopupArrowStyle"
          :arrow-placement="trackPopupArrowPlacement"
          @select="selectTrackColor"
          @close="closeTrackDialogs"
        />

        <footer class="track-editor-footer">
          <div class="status-line">
            <span>{{ t('freePlay.trackEditorSelectedCount', { count: selectedCount }) }}</span>
            <span>{{ t('freePlay.trackEditorTracksCount', { count: draftTracks.length }) }}</span>
            <span v-if="dirty" class="dirty-indicator">{{ t('freePlay.trackEditorUnsavedChanges') }}</span>
          </div>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.track-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 1400;
  padding: 6px;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(3px);
}

.track-editor-shell {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: #24272c;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.track-editor-header {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: center;
  padding: 0.35rem 0.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.18);
}

.editor-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  font-size: 1.35rem;
  line-height: 1;
}

.editor-toolbar,
.tool-group,
.primary-actions,
.dialog-actions,
.track-editor-footer,
.status-line,
.track-legend,
.track-chip,
.select-label {
  display: flex;
  align-items: center;
}

.editor-toolbar {
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-start;
}

.tool-group {
  gap: 0.22rem;
  padding: 0.18rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tool-button {
  min-width: 30px;
  height: 30px;
  padding: 0 0.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  cursor: pointer;
}

.tool-button:hover:not(:disabled),
.tool-button.active {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.14);
  border-color: rgba(251, 191, 36, 0.36);
}

.tool-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.tool-button.danger:hover:not(:disabled) {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.58);
  border-color: rgba(248, 113, 113, 0.45);
}

.tool-button--text {
  min-width: 66px;
  font-weight: 700;
}

.quantize-option {
  min-width: 38px;
  padding: 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
}

.volume-group {
  gap: 0.35rem;
}

.volume-icon {
  color: #d1d5db;
  font-size: 0.82rem;
}

.volume-slider {
  width: 96px;
  height: 28px;
  margin: 0;
  accent-color: #fbbf24;
}

.select-label {
  gap: 0.35rem;
  color: #d1d5db;
  font-size: 0.8rem;
}

.subdivision-select {
  max-width: 82px;
  height: 28px;
  padding: 0 1.65rem 0 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  background: #1f2329;
  color: #f3f4f6;
}

.primary-actions,
.dialog-actions {
  gap: 0.3rem;
}

.dialog-actions {
  justify-content: flex-end;
}

.action-button {
  height: 30px;
  padding: 0 0.7rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f3f4f6;
  cursor: pointer;
}

.action-button--icon {
  width: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.06);
}

.action-button.primary {
  background: #2563eb;
  border-color: rgba(147, 197, 253, 0.5);
}

.close-button {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(248, 113, 113, 0.45);
  border-radius: 4px;
  background: rgba(127, 29, 29, 0.72);
  color: #fecaca;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.close-button:hover {
  background: rgba(185, 28, 28, 0.9);
  color: #ffffff;
}

.track-editor-body {
  position: relative;
  min-height: 0;
  padding: 0.35rem;
  overflow: hidden;
}

.track-editor-body--split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 0.35rem;
}

.editor-side-panel,
.editor-workspace-shell {
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(17, 24, 39, 0.58);
  overflow: hidden;
}

.editor-side-stack {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 0.35rem;
}

.editor-side-panel {
  display: flex;
  flex-direction: column;
}

.editor-workspace-shell {
  position: relative;
}

.panel-header {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  padding: 0.35rem 0.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.24);
}

.panel-header h3 {
  margin: 0;
  color: #f3f4f6;
  font-size: 0.82rem;
}

.track-card-list,
.inspector-form {
  min-height: 0;
  overflow-y: auto;
}

.track-card-list {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0.35rem;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.editor-track-card {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 0.35rem;
  min-height: 82px;
  padding: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  overflow: hidden;
  box-sizing: border-box;
}

.editor-track-card.active {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(251, 191, 36, 0.1);
}

.editor-track-card.muted {
  opacity: 0.58;
}

.track-instrument-button {
  width: 54px;
  height: 70px;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.32rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.16), transparent 46%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.16));
  color: #f3f4f6;
  cursor: pointer;
}

.track-instrument-button:hover,
.track-instrument-button:focus-visible {
  border-color: rgba(251, 191, 36, 0.45);
  background: rgba(251, 191, 36, 0.12);
  outline: none;
}

.track-instrument-emoji {
  font-size: 1.95rem;
  line-height: 1;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.45));
  pointer-events: none;
}

.track-card-content {
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-rows: 24px 18px 24px;
  gap: 0.2rem;
  overflow: hidden;
}

.track-card-controls {
  display: grid;
  grid-template-columns: repeat(7, 22px);
  align-items: center;
  justify-content: start;
  gap: 0.18rem;
  overflow: hidden;
}

.track-color-button {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 4px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  cursor: pointer;
  flex-shrink: 0;
}

.track-color-button:hover,
.track-color-button:focus-visible {
  transform: scale(1.08);
  outline: 1px solid rgba(251, 191, 36, 0.7);
  outline-offset: 2px;
}

.track-name-input,
.compact-select,
.inspector-field input,
.inspector-field select {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  background: #1f2329;
  color: #f3f4f6;
}

.track-name-input {
  width: 100%;
  height: 24px;
  padding: 0 0.35rem;
  font-weight: 700;
  box-sizing: border-box;
}

.track-card-meta {
  min-width: 0;
  overflow: hidden;
  color: #aeb4bf;
  font-size: 0.72rem;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-icon-button {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  cursor: pointer;
}

.panel-icon-button:hover:not(:disabled),
.panel-icon-button.active {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.36);
  background: rgba(251, 191, 36, 0.12);
}

.panel-icon-button.danger:hover:not(:disabled) {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.5);
}

.panel-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.compact-select {
  flex: 1 1 0;
  width: 100%;
  max-width: 100%;
  height: 26px;
  padding: 0 1.6rem 0 0.4rem;
}

.instrument-dialog-button {
  display: inline-grid;
  grid-template-columns: 1.2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.32rem;
  text-align: left;
  cursor: pointer;
}

.instrument-dialog-button:hover,
.instrument-dialog-button:focus-visible {
  border-color: rgba(251, 191, 36, 0.42);
  background: rgba(251, 191, 36, 0.1);
  outline: none;
}

.instrument-emoji,
.instrument-dialog-caret {
  flex-shrink: 0;
  pointer-events: none;
}

.instrument-emoji {
  line-height: 1;
  text-align: center;
}

.instrument-dialog-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.instrument-dialog-caret {
  color: #9ca3af;
  font-size: 0.65rem;
}

.compact-select option,
.inspector-field select option,
.subdivision-select option {
  background: #1f2329;
  color: #f3f4f6;
}

.inspector-empty {
  padding: 0.5rem;
  color: #aeb4bf;
  font-size: 0.78rem;
}

.inspector-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.45rem;
}

.selection-summary {
  color: #fbbf24;
  font-size: 0.76rem;
  font-weight: 700;
}

.inspector-field {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 0.35rem;
  align-items: center;
  color: #d1d5db;
  font-size: 0.76rem;
}

.inspector-field input,
.inspector-field select {
  height: 26px;
  padding: 0 0.4rem;
}

.empty-state {
  position: absolute;
  inset: 50% auto auto 50%;
  z-index: 5;
  transform: translate(-50%, -50%);
  padding: 0.75rem 1rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #d1d5db;
  pointer-events: none;
}

.track-editor-body :deep(.track-editor-grid-shell) {
  height: 100%;
}

.track-editor-footer {
  gap: 1rem;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.18);
}

.status-line,
.track-legend {
  flex-wrap: wrap;
  gap: 0.6rem;
  color: #cbd5e1;
  font-size: 0.83rem;
}

.dirty-indicator {
  color: #fbbf24;
}

.track-chip {
  gap: 0.35rem;
  max-width: 16rem;
  color: #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-color {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.track-editor-enter-active,
.track-editor-leave-active {
  transition: opacity 0.18s ease;
}

.track-editor-enter-from,
.track-editor-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .track-editor-header {
    grid-template-columns: 1fr;
  }

  .dialog-actions {
    justify-content: center;
  }
}
</style>
