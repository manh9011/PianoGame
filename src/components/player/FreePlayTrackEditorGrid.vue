<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { FreePlayRecordedNote, FreePlayTimeSignature, FreePlayTrack } from '../../stores/freePlayStore'
import type { FreePlayEditorSubdivision } from '../../modules/freePlay/editor/freePlayTrackEditorSnap'
import { quarterNoteUs, snapTimeUs, subdivisionUs } from '../../modules/freePlay/editor/freePlayTrackEditorSnap'
import { clampPitch, editorBeatUs, editorMeasureUs, FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, pitchToY, timeToX, xToTime, yToPitch } from '../../modules/freePlay/editor/freePlayTrackEditorGeometry'
import { canPlaceTrackEditorNotes, cloneTrackEditorTracks, mutateTrackEditorNotes } from '../../modules/freePlay/editor/freePlayTrackEditorMutations'

export type FreePlayTrackEditorMode = 'select' | 'draw' | 'marquee' | 'erase'

type InteractionKind = 'idle' | 'dragging-note' | 'resizing-left' | 'resizing-right' | 'drawing-note' | 'marquee-selecting' | 'panning-view' | 'erasing-notes'

interface EditorPoint {
  x: number
  y: number
  timeUs: number
  noteId: number
}

interface DragSnapshot {
  id: string
  trackId: number
  startUs: number
  endUs: number
  noteId: number
}

interface InteractionState {
  kind: InteractionKind
  pointerId: number
  origin: EditorPoint
  anchorNoteId?: string
  snapshots: DragSnapshot[]
  marquee?: { left: number; top: number; width: number; height: number }
  pan?: { clientX: number; clientY: number; scrollLeft: number; scrollTop: number }
  erasedNoteIds?: string[]
}

interface DrawableNote extends FreePlayRecordedNote {
  color: string
  trackIndex: number
  muted: boolean
  style: Record<string, string>
}

interface VelocityBar {
  id: string
  noteId: string
  color: string
  muted: boolean
  selected: boolean
  style: Record<string, string>
}

const props = defineProps<{
  tracks: FreePlayTrack[]
  bpm: number
  timeSignature: FreePlayTimeSignature
  mode: FreePlayTrackEditorMode
  snapEnabled: boolean
  snapSubdivision: FreePlayEditorSubdivision
  selectedNoteIds: string[]
  activeTrackId: number | null
  mutedTrackIds?: number[]
  hiddenTrackIds?: number[]
  velocityLabel: string
  pixelsPerQuarter: number
  rowHeight: number
  playheadUs: number
  followPlayhead: boolean
}>()

const emit = defineEmits<{
  'update:tracks': [tracks: FreePlayTrack[]]
  'update:selectedNoteIds': [ids: string[]]
  'preview-note': [note: FreePlayRecordedNote]
  seek: [timeUs: number]
  dirty: []
}>()

const viewportRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)
const velocityLaneRef = ref<HTMLElement | null>(null)
const interaction = ref<InteractionState>({ kind: 'idle', pointerId: -1, origin: { x: 0, y: 0, timeUs: 0, noteId: 60 }, snapshots: [] })
const velocityDragNoteId = ref<string | null>(null)
let draftNoteCounter = 1

const selectedSet = computed(() => new Set(props.selectedNoteIds))
const mutedSet = computed(() => new Set(props.mutedTrackIds ?? []))
const hiddenSet = computed(() => new Set(props.hiddenTrackIds ?? []))
const snapUnitUs = computed(() => subdivisionUs(props.bpm, props.snapSubdivision))
const defaultNoteDurationUs = computed(() => props.snapEnabled ? snapUnitUs.value : quarterNoteUs(props.bpm) / 4)
const maxEndUs = computed(() => Math.max(0, ...props.tracks.flatMap(track => track.notes.map(note => note.endUs))))
const timelineDurationUs = computed(() => Math.max(quarterNoteUs(props.bpm) * 16, maxEndUs.value + quarterNoteUs(props.bpm) * 4))
const gridWidth = computed(() => Math.ceil(timeToX(timelineDurationUs.value, props.bpm, props.pixelsPerQuarter)))
const gridHeight = computed(() => 128 * props.rowHeight)
const playheadX = computed(() => Math.min(gridWidth.value, timeToX(props.playheadUs, props.bpm, props.pixelsPerQuarter)))
const beatUs = computed(() => editorBeatUs(props.bpm, props.timeSignature))
const measureUs = computed(() => editorMeasureUs(props.bpm, props.timeSignature))

const beatLines = computed(() => {
  const lines: { id: string; x: number; measure: boolean; label?: string }[] = []
  const beat = Math.max(1, beatUs.value)
  const measure = Math.max(1, measureUs.value)
  for (let timeUs = 0; timeUs <= timelineDurationUs.value; timeUs += beat) {
    const measureLine = Math.abs(timeUs / measure - Math.round(timeUs / measure)) < 0.001
    const measureNumber = Math.floor(timeUs / measure) + 1
    lines.push({ id: `beat:${timeUs}`, x: timeToX(timeUs, props.bpm, props.pixelsPerQuarter), measure: measureLine, label: measureLine ? String(measureNumber) : undefined })
  }
  return lines
})

const subdivisionLines = computed(() => {
  const lines: { id: string; x: number }[] = []
  const step = Math.max(1, snapUnitUs.value)
  const beat = Math.max(1, beatUs.value)
  for (let timeUs = 0; timeUs <= timelineDurationUs.value; timeUs += step) {
    if (Math.abs(timeUs / beat - Math.round(timeUs / beat)) < 0.001) continue
    lines.push({ id: `sub:${timeUs}`, x: timeToX(timeUs, props.bpm, props.pixelsPerQuarter) })
  }
  return lines
})

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

const pianoKeys = computed(() => Array.from({ length: 128 }, (_, index) => {
  const noteId = 127 - index
  const pitchClass = noteId % 12
  const noteName = NOTE_NAMES[pitchClass]
  return {
    noteId,
    noteName,
    label: `${noteName}${Math.floor(noteId / 12) - 1}`,
    black: BLACK_PITCH_CLASSES.has(pitchClass),
    octave: pitchClass === 0,
  }
}))

interface OctaveBand {
  id: string
  top: number
  height: number
  shaded: boolean
}

const octaveBands = computed<OctaveBand[]>(() => {
  const bands: OctaveBand[] = []
  const octaveCStartPitches = [120, 108, 96, 84, 72, 60, 48, 36, 24, 12, 0]

  octaveCStartPitches.forEach((cPitch, index) => {
    const octaveNum = Math.floor(cPitch / 12) - 1
    const topPitch = index === 0 ? 127 : cPitch + 11
    const bottomPitch = cPitch
    const topY = pitchToY(topPitch, props.rowHeight)
    const bottomY = pitchToY(bottomPitch, props.rowHeight) + props.rowHeight
    const height = bottomY - topY

    bands.push({
      id: `octave:${cPitch}`,
      top: topY,
      height,
      shaded: octaveNum % 2 !== 0,
    })
  })
  return bands
})

const blackKeyRows = computed(() => {
  return pianoKeys.value
    .filter(k => k.black)
    .map(k => ({
      noteId: k.noteId,
      top: pitchToY(k.noteId, props.rowHeight),
      height: props.rowHeight,
    }))
})

const drawableNotes = computed<DrawableNote[]>(() => props.tracks
  .filter(track => !hiddenSet.value.has(track.id))
  .flatMap((track, trackIndex) => track.notes.map(note => {
    const left = timeToX(note.startUs, props.bpm, props.pixelsPerQuarter)
    const right = timeToX(note.endUs, props.bpm, props.pixelsPerQuarter)
    const muted = mutedSet.value.has(track.id)
    return {
      ...note,
      color: track.color,
      trackIndex,
      muted,
      style: {
        left: `${left}px`,
        top: `${pitchToY(note.noteId, props.rowHeight)}px`,
        width: `${Math.max(8, right - left)}px`,
        height: `${Math.max(10, props.rowHeight - 2)}px`,
        backgroundColor: track.color,
        opacity: muted ? '0.32' : '1',
      },
    }
  })))

const velocityBars = computed<VelocityBar[]>(() => drawableNotes.value.map(note => {
  const left = timeToX(note.startUs, props.bpm, props.pixelsPerQuarter)
  const height = Math.max(3, Math.round((note.velocity / 127) * 88))
  return {
    id: `velocity:${note.id}`,
    noteId: note.id,
    color: note.color,
    muted: note.muted,
    selected: selectedSet.value.has(note.id),
    style: {
      left: `${left}px`,
      height: `${height}px`,
      backgroundColor: note.color,
      opacity: note.muted ? '0.28' : '0.88',
    },
  }
}))

function cloneTracks() {
  return cloneTrackEditorTracks(props.tracks)
}

function emitTracks(tracks: FreePlayTrack[]) {
  emit('update:tracks', tracks)
  emit('dirty')
}

function setSelected(ids: string[]) {
  emit('update:selectedNoteIds', [...new Set(ids)])
}

function getPoint(event: PointerEvent): EditorPoint {
  const rect = gridRef.value?.getBoundingClientRect()
  const x = Math.max(0, event.clientX - (rect?.left ?? 0))
  const y = Math.max(0, event.clientY - (rect?.top ?? 0))
  return {
    x,
    y,
    timeUs: xToTime(x, props.bpm, props.pixelsPerQuarter),
    noteId: yToPitch(y, props.rowHeight),
  }
}

function velocityFromEvent(event: PointerEvent) {
  const rect = velocityLaneRef.value?.getBoundingClientRect()
  const y = Math.max(0, Math.min(rect?.height ?? 1, event.clientY - (rect?.top ?? 0)))
  return Math.max(1, Math.min(127, Math.round((1 - y / Math.max(1, rect?.height ?? 1)) * 127)))
}

function noteById(id: string) {
  for (const track of props.tracks) {
    const note = track.notes.find(note => note.id === id)
    if (note) return note
  }
  return null
}

function snapshotsFor(ids: string[]) {
  return ids.flatMap(id => {
    const note = noteById(id)
    return note ? [{ id: note.id, trackId: note.trackId, startUs: note.startUs, endUs: note.endUs, noteId: note.noteId }] : []
  })
}

function updateNotes(snapshots: DragSnapshot[], updater: (snapshot: DragSnapshot) => Partial<FreePlayRecordedNote>) {
  const nextTracks = mutateTrackEditorNotes(props.tracks, snapshots.map(snapshot => snapshot.id), note => {
    const snapshot = snapshots.find(item => item.id === note.id)
    return snapshot ? updater(snapshot) : undefined
  })
  if (!nextTracks) return
  emitTracks(nextTracks)
}

function deleteNoteIds(ids: string[]) {
  if (!ids.length) return
  const removingIds = new Set(ids)
  const tracks = cloneTracks().map(track => ({ ...track, notes: track.notes.filter(note => !removingIds.has(note.id)) }))
  emitTracks(tracks)
  setSelected(props.selectedNoteIds.filter(id => !removingIds.has(id)))
}

function deleteSelected() {
  deleteNoteIds(props.selectedNoteIds)
}

function noteIdAtPointer(event: PointerEvent) {
  const rect = gridRef.value?.getBoundingClientRect()
  if (!rect) return null
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  return drawableNotes.value.find(note => {
    const left = timeToX(note.startUs, props.bpm, props.pixelsPerQuarter)
    const right = timeToX(note.endUs, props.bpm, props.pixelsPerQuarter)
    const top = pitchToY(note.noteId, props.rowHeight)
    const bottom = top + props.rowHeight
    return x >= left && x <= right && y >= top && y <= bottom
  })?.id ?? null
}

defineExpose({ deleteSelected })

function handleGridPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const point = getPoint(event)
  gridRef.value?.setPointerCapture(event.pointerId)

  if (props.mode === 'erase') {
    interaction.value = { kind: 'erasing-notes', pointerId: event.pointerId, origin: point, snapshots: [], erasedNoteIds: [] }
    return
  }

  if (props.mode === 'draw') {
    const startUs = snapTimeUs(point.timeUs, props.bpm, props.snapSubdivision, props.snapEnabled)
    const targetTrackId = props.activeTrackId ?? props.tracks[0]?.id ?? 1
    const note: FreePlayRecordedNote = {
      id: `draft:${draftNoteCounter++}`,
      trackId: targetTrackId,
      noteId: point.noteId,
      startUs,
      endUs: startUs + Math.max(FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, defaultNoteDurationUs.value),
      velocity: 80,
      source: 'pointer',
    }
    if (!canPlaceTrackEditorNotes(props.tracks, [note])) return
    const tracks = cloneTracks()
    const targetTrack = tracks.find(track => track.id === targetTrackId) ?? tracks[0]
    const savedNote = { ...note, trackId: targetTrack?.id ?? note.trackId }
    if (targetTrack) targetTrack.notes.push(savedNote)
    emitTracks(tracks)
    setSelected([savedNote.id])
    interaction.value = { kind: 'drawing-note', pointerId: event.pointerId, origin: point, anchorNoteId: savedNote.id, snapshots: [{ id: savedNote.id, trackId: savedNote.trackId, startUs, endUs: savedNote.endUs, noteId: point.noteId }] }
    return
  }

  if (props.mode === 'marquee') {
    interaction.value = { kind: 'marquee-selecting', pointerId: event.pointerId, origin: point, snapshots: [], marquee: { left: point.x, top: point.y, width: 0, height: 0 } }
    return
  }

  setSelected([])
  if (props.mode === 'select' && viewportRef.value) {
    interaction.value = {
      kind: 'panning-view',
      pointerId: event.pointerId,
      origin: point,
      snapshots: [],
      pan: {
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: viewportRef.value.scrollLeft,
        scrollTop: viewportRef.value.scrollTop,
      },
    }
  }
}

function handleNotePointerDown(event: PointerEvent, note: DrawableNote) {
  if (event.button !== 0) return
  event.stopPropagation()
  const point = getPoint(event)

  if (props.mode !== 'erase') emit('preview-note', note)

  if (props.mode === 'erase') {
    gridRef.value?.setPointerCapture(event.pointerId)
    deleteNoteIds([note.id])
    interaction.value = { kind: 'erasing-notes', pointerId: event.pointerId, origin: point, snapshots: [], erasedNoteIds: [note.id] }
    return
  }

  gridRef.value?.setPointerCapture(event.pointerId)

  if (event.ctrlKey || event.metaKey) {
    const next = new Set(props.selectedNoteIds)
    if (next.has(note.id)) next.delete(note.id)
    else next.add(note.id)
    setSelected([...next])
    interaction.value = { kind: 'idle', pointerId: -1, origin: point, snapshots: [] }
    return
  }

  const ids = selectedSet.value.has(note.id) ? props.selectedNoteIds : [note.id]
  if (!selectedSet.value.has(note.id)) setSelected(ids)
  interaction.value = { kind: 'dragging-note', pointerId: event.pointerId, origin: point, anchorNoteId: note.id, snapshots: snapshotsFor(ids) }
}

function handleResizePointerDown(event: PointerEvent, note: DrawableNote, side: 'left' | 'right') {
  if (event.button !== 0) return
  event.stopPropagation()
  emit('preview-note', note)
  const point = getPoint(event)
  gridRef.value?.setPointerCapture(event.pointerId)
  setSelected([note.id])
  interaction.value = { kind: side === 'left' ? 'resizing-left' : 'resizing-right', pointerId: event.pointerId, origin: point, anchorNoteId: note.id, snapshots: snapshotsFor([note.id]) }
}

function updateDrag(point: EditorPoint) {
  const state = interaction.value
  const anchor = state.snapshots.find(snapshot => snapshot.id === state.anchorNoteId) ?? state.snapshots[0]
  if (!anchor) return
  const rawAnchorStart = anchor.startUs + (point.timeUs - state.origin.timeUs)
  const snappedAnchorStart = snapTimeUs(rawAnchorStart, props.bpm, props.snapSubdivision, props.snapEnabled)
  let deltaTimeUs = snappedAnchorStart - anchor.startUs
  const minStart = Math.min(...state.snapshots.map(snapshot => snapshot.startUs))
  deltaTimeUs = Math.max(deltaTimeUs, -minStart)

  const rawPitchDelta = point.noteId - state.origin.noteId
  const minPitch = Math.min(...state.snapshots.map(snapshot => snapshot.noteId))
  const maxPitch = Math.max(...state.snapshots.map(snapshot => snapshot.noteId))
  const deltaPitch = Math.max(-minPitch, Math.min(127 - maxPitch, rawPitchDelta))

  updateNotes(state.snapshots, snapshot => ({
    startUs: Math.max(0, Math.round(snapshot.startUs + deltaTimeUs)),
    endUs: Math.max(FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, Math.round(snapshot.endUs + deltaTimeUs)),
    noteId: clampPitch(snapshot.noteId + deltaPitch),
  }))
}

function updateResize(point: EditorPoint) {
  const state = interaction.value
  const snapshot = state.snapshots[0]
  if (!snapshot) return
  const snappedTime = snapTimeUs(point.timeUs, props.bpm, props.snapSubdivision, props.snapEnabled)
  if (state.kind === 'resizing-left') {
    const startUs = Math.max(0, Math.min(snappedTime, snapshot.endUs - FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US))
    updateNotes([snapshot], () => ({ startUs }))
  } else {
    const minDuration = props.snapEnabled ? Math.max(FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, snapUnitUs.value) : FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US
    const endUs = Math.max(snapshot.startUs + minDuration, snappedTime)
    updateNotes([snapshot], () => ({ endUs }))
  }
}

function updateDrawing(point: EditorPoint) {
  const state = interaction.value
  const snapshot = state.snapshots[0]
  if (!snapshot) return
  const currentUs = snapTimeUs(point.timeUs, props.bpm, props.snapSubdivision, props.snapEnabled)
  const startUs = Math.min(snapshot.startUs, currentUs)
  const endUs = Math.max(snapshot.startUs + FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, Math.max(snapshot.startUs, currentUs))
  updateNotes([snapshot], () => ({
    startUs,
    endUs: Math.max(startUs + FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, endUs),
    noteId: point.noteId,
  }))
}

function noteRect(note: FreePlayRecordedNote) {
  const left = timeToX(note.startUs, props.bpm, props.pixelsPerQuarter)
  const right = timeToX(note.endUs, props.bpm, props.pixelsPerQuarter)
  const top = pitchToY(note.noteId, props.rowHeight)
  return { left, right, top, bottom: top + props.rowHeight }
}

function updateMarquee(point: EditorPoint) {
  const state = interaction.value
  const left = Math.min(state.origin.x, point.x)
  const top = Math.min(state.origin.y, point.y)
  const right = Math.max(state.origin.x, point.x)
  const bottom = Math.max(state.origin.y, point.y)
  state.marquee = { left, top, width: right - left, height: bottom - top }
  interaction.value = { ...state }
  const selected = props.tracks.flatMap(track => track.notes).filter(note => {
    const rect = noteRect(note)
    return rect.left <= right && rect.right >= left && rect.top <= bottom && rect.bottom >= top
  }).map(note => note.id)
  setSelected(selected)
}

function handlePointerMove(event: PointerEvent) {
  const state = interaction.value
  if (state.kind === 'idle' || state.pointerId !== event.pointerId) return
  if (state.kind === 'panning-view') {
    if (!viewportRef.value || !state.pan) return
    viewportRef.value.scrollLeft = state.pan.scrollLeft + state.pan.clientX - event.clientX
    viewportRef.value.scrollTop = state.pan.scrollTop + state.pan.clientY - event.clientY
    return
  }
  if (state.kind === 'erasing-notes') {
    const noteId = noteIdAtPointer(event)
    if (!noteId || state.erasedNoteIds?.includes(noteId)) return
    deleteNoteIds([noteId])
    interaction.value = { ...state, erasedNoteIds: [...(state.erasedNoteIds ?? []), noteId] }
    return
  }
  const point = getPoint(event)
  if (state.kind === 'dragging-note') updateDrag(point)
  else if (state.kind === 'resizing-left' || state.kind === 'resizing-right') updateResize(point)
  else if (state.kind === 'drawing-note') updateDrawing(point)
  else if (state.kind === 'marquee-selecting') updateMarquee(point)
}

function handlePointerUp(event: PointerEvent) {
  if (interaction.value.pointerId !== event.pointerId) return
  gridRef.value?.releasePointerCapture(event.pointerId)
  interaction.value = { kind: 'idle', pointerId: -1, origin: { x: 0, y: 0, timeUs: 0, noteId: 60 }, snapshots: [] }
}

function setVelocityForSelection(noteId: string, velocity: number) {
  const selectedIds = selectedSet.value.has(noteId) ? props.selectedNoteIds : [noteId]
  const tracks = mutateTrackEditorNotes(props.tracks, selectedIds, () => ({ velocity }))
  if (!tracks) return
  setSelected(selectedIds)
  emitTracks(tracks)
}

function handleVelocityPointerDown(event: PointerEvent, noteId: string) {
  if (event.button !== 0) return
  event.stopPropagation()
  velocityLaneRef.value?.setPointerCapture(event.pointerId)
  velocityDragNoteId.value = noteId
  setVelocityForSelection(noteId, velocityFromEvent(event))
}

function handleVelocityPointerMove(event: PointerEvent) {
  if (event.buttons !== 1 || !velocityDragNoteId.value) return
  setVelocityForSelection(velocityDragNoteId.value, velocityFromEvent(event))
}

function handleVelocityPointerUp(event: PointerEvent) {
  if (!velocityDragNoteId.value) return
  velocityLaneRef.value?.releasePointerCapture(event.pointerId)
  velocityDragNoteId.value = null
}

function handleRulerDoubleClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = Math.max(0, event.clientX - rect.left)
  const timeUs = xToTime(x, props.bpm, props.pixelsPerQuarter)
  const snappedTimeUs = snapTimeUs(timeUs, props.bpm, props.snapSubdivision, props.snapEnabled)
  emit('seek', snappedTimeUs)
}

function scrollPlayheadIntoView() {
  if (!props.followPlayhead || !viewportRef.value) return
  const viewport = viewportRef.value
  const pianoWidth = 64
  const viewportLeft = Math.max(0, viewport.scrollLeft - pianoWidth)
  const viewportRight = viewportLeft + Math.max(0, viewport.clientWidth - pianoWidth)
  const x = playheadX.value
  const margin = Math.max(80, Math.min(180, viewport.clientWidth * 0.18))

  if (x < viewportLeft + margin) {
    viewport.scrollLeft = Math.max(0, x + pianoWidth - margin)
  } else if (x > viewportRight - margin) {
    viewport.scrollLeft = Math.max(0, x + pianoWidth - viewport.clientWidth + margin)
  }
}

watch(() => props.playheadUs, () => {
  void nextTick(scrollPlayheadIntoView)
})
</script>

<template>
  <div class="track-editor-grid-shell">
    <div ref="viewportRef" class="grid-viewport">
      <div class="editor-canvas" :style="{ width: `${64 + gridWidth}px` }">
        <div class="ruler-row">
          <div class="ruler-corner"></div>
          <div class="measure-ruler" :style="{ width: `${gridWidth}px` }" @dblclick="handleRulerDoubleClick">
            <div class="playhead playhead--ruler" :style="{ left: `${playheadX}px` }">
              <span class="playhead-triangle"></span>
            </div>
            <div
              v-for="line in beatLines"
              :key="`ruler:${line.id}`"
              class="ruler-tick"
              :class="{ 'ruler-tick--measure': line.measure }"
              :style="{ left: `${line.x}px` }"
            >
              <span v-if="line.label" class="ruler-label">{{ line.label }}</span>
            </div>
          </div>
        </div>

        <div class="note-row" :style="{ height: `${gridHeight}px` }">
          <div class="piano-ruler" :style="{ height: `${gridHeight}px` }">
            <div
              v-for="key in pianoKeys"
              :key="key.noteId"
              class="piano-key"
              :class="{ 'piano-key--black': key.black, 'piano-key--octave': key.octave }"
              :style="{ top: `${pitchToY(key.noteId, rowHeight)}px`, height: `${rowHeight}px` }"
            >
              <span class="piano-key-label">{{ key.octave ? key.label : key.noteName }}</span>
            </div>
          </div>
          <div
            ref="gridRef"
            class="note-grid"
            :class="{ 'note-grid--pan-ready': mode === 'select', 'note-grid--erase-ready': mode === 'erase', 'note-grid--panning': interaction.kind === 'panning-view', 'note-grid--erasing': interaction.kind === 'erasing-notes' }"
            :style="{ width: `${gridWidth}px`, height: `${gridHeight}px`, '--row-height': `${rowHeight}px` }"
            @pointerdown="handleGridPointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerUp"
            @pointercancel="handlePointerUp"
          >
            <div
              v-for="band in octaveBands"
              :key="band.id"
              class="octave-band"
              :class="{ 'octave-band--shaded': band.shaded }"
              :style="{ top: `${band.top}px`, height: `${band.height}px` }"
            >
              <div class="octave-divider-line"></div>
            </div>
            <div
              v-for="row in blackKeyRows"
              :key="`black:${row.noteId}`"
              class="black-key-row"
              :style="{ top: `${row.top}px`, height: `${row.height}px` }"
            ></div>
            <div
              v-for="line in subdivisionLines"
              :key="line.id"
              class="grid-line grid-line--subdivision"
              :style="{ left: `${line.x}px` }"
            ></div>
            <div
              v-for="line in beatLines"
              :key="line.id"
              class="grid-line"
              :class="{ 'grid-line--measure': line.measure }"
              :style="{ left: `${line.x}px` }"
            ></div>
            <div class="playhead playhead--grid" :style="{ left: `${playheadX}px` }"></div>
            <button
              v-for="note in drawableNotes"
              :key="note.id"
              class="editor-note"
              :class="{ selected: selectedSet.has(note.id) }"
              :style="note.style"
              type="button"
              @pointerdown="handleNotePointerDown($event, note)"
            >
              <span class="note-handle note-handle--left" @pointerdown="handleResizePointerDown($event, note, 'left')"></span>
              <span class="note-body"></span>
              <span class="note-handle note-handle--right" @pointerdown="handleResizePointerDown($event, note, 'right')"></span>
            </button>
            <div
              v-if="interaction.marquee"
              class="selection-rect"
              :style="{
                left: `${interaction.marquee.left}px`,
                top: `${interaction.marquee.top}px`,
                width: `${interaction.marquee.width}px`,
                height: `${interaction.marquee.height}px`,
              }"
            ></div>
          </div>
        </div>

        <div class="velocity-row">
          <div class="velocity-corner">{{ velocityLabel }}</div>
          <div
            ref="velocityLaneRef"
            class="velocity-lane"
            :style="{ width: `${gridWidth}px` }"
            @pointermove="handleVelocityPointerMove"
            @pointerup="handleVelocityPointerUp"
            @pointercancel="handleVelocityPointerUp"
          >
            <div class="playhead playhead--velocity" :style="{ left: `${playheadX}px` }"></div>
            <div class="velocity-guide velocity-guide--top">127</div>
            <div class="velocity-guide velocity-guide--mid">64</div>
            <button
              v-for="bar in velocityBars"
              :key="bar.id"
              class="velocity-bar"
              :class="{ selected: bar.selected, muted: bar.muted }"
              :style="bar.style"
              type="button"
              :data-note-id="bar.noteId"
              @pointerdown="handleVelocityPointerDown($event, bar.noteId)"
            ></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-editor-grid-shell {
  min-height: 0;
  display: block;
  background: #202226;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  overflow: hidden;
}

.grid-viewport {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  scrollbar-color: #6b7280 #1f2329;
  scrollbar-width: thin;
}

.grid-viewport::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.grid-viewport::-webkit-scrollbar-track {
  background: #1f2329;
}

.grid-viewport::-webkit-scrollbar-thumb {
  border: 3px solid #1f2329;
  border-radius: 999px;
  background: #6b7280;
}

.editor-canvas {
  position: relative;
  min-width: 100%;
}

.ruler-row,
.velocity-row,
.note-row {
  display: flex;
  align-items: stretch;
}

.ruler-row {
  position: sticky;
  top: 0;
  z-index: 40;
}

.velocity-row {
  position: sticky;
  bottom: 0;
  z-index: 40;
}

.ruler-corner,
.velocity-corner {
  position: sticky;
  left: 0;
  z-index: 42;
  width: 64px;
  height: 34px;
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid rgba(255, 255, 255, 0.16);
  background: #292c31;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.68rem;
  font-weight: 700;
}

.ruler-corner::after {
  content: '';
}

.measure-ruler {
  position: relative;
  height: 34px;
  flex: 0 0 auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(to bottom, #41454c, #2f3339);
  cursor: text;
}

.ruler-tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.ruler-tick--measure {
  width: 2px;
  background: rgba(255, 255, 255, 0.45);
}

.ruler-label {
  position: absolute;
  top: 8px;
  left: 6px;
  min-width: 76px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  z-index: 30;
  background: rgba(96, 165, 250, 0.95);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.28);
  pointer-events: none;
}

.playhead--ruler {
  z-index: 35;
}

.playhead--grid,
.playhead--velocity {
  top: 0;
  bottom: 0;
}

.playhead-triangle {
  position: absolute;
  top: 0;
  left: -6px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 10px solid #93c5fd;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55));
}

.piano-ruler {
  position: sticky;
  left: 0;
  z-index: 20;
  width: 64px;
  flex: 0 0 64px;
  background: #292c31;
  border-right: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 4px 0 10px rgba(0, 0, 0, 0.22);
}

.piano-key {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.35rem;
  border: 1px solid #9ca3af;
  border-left: 0;
  border-top: 0;
  background: linear-gradient(to bottom, #fbfbf8, #d7d8d2);
  color: #33373d;
  font-size: 0.66rem;
  font-weight: 700;
  pointer-events: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.piano-key--black {
  left: 0;
  right: 20px;
  z-index: 1;
  border: 1px solid #060606;
  border-left: 0;
  border-radius: 0 0 5px 0;
  background: linear-gradient(to bottom, #2f3137, #050505 72%, #111);
  color: rgba(255, 255, 255, 0.9);
  box-shadow: inset -4px 0 0 rgba(255, 255, 255, 0.07), 0 2px 4px rgba(0, 0, 0, 0.55);
}

.piano-key--octave:not(.piano-key--black) {
  color: #1d4ed8;
}

.piano-key-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-grid {
  position: relative;
  flex: 0 0 auto;
  min-width: calc(100% - 64px);
  background-color: #202328;
  background-image: repeating-linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.04) 0,
    rgba(255, 255, 255, 0.04) 1px,
    transparent 1px,
    transparent var(--row-height)
  );
  touch-action: none;
}

.octave-band {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  background-color: rgba(255, 255, 255, 0.015);
}

.octave-band--shaded {
  background-color: rgba(255, 255, 255, 0.06);
}

.octave-divider-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(251, 191, 36, 0.32);
  z-index: 1;
}

.black-key-row {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  background-color: rgba(0, 0, 0, 0.24);
}

.note-grid--pan-ready {
  cursor: grab;
}

.note-grid--panning {
  cursor: grabbing;
}

.note-grid--erase-ready,
.note-grid--erasing {
  cursor: cell;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.14);
  pointer-events: none;
}

.grid-line--subdivision {
  background: rgba(255, 255, 255, 0.055);
}

.grid-line--measure {
  width: 2px;
  background: rgba(251, 191, 36, 0.32);
}

.editor-note {
  position: absolute;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) 8px;
  align-items: stretch;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  cursor: grab;
  overflow: hidden;
  touch-action: none;
}

.editor-note.selected {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
  z-index: 5;
}

.editor-note:active {
  cursor: grabbing;
}

.note-body {
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.02) 40%, rgba(0, 0, 0, 0.16));
  pointer-events: none;
}

.note-handle {
  opacity: 0;
  background: rgba(255, 255, 255, 0.72);
  cursor: ew-resize;
}

.editor-note:hover .note-handle,
.editor-note.selected .note-handle {
  opacity: 1;
}

.selection-rect {
  position: absolute;
  border: 1px solid rgba(96, 165, 250, 0.95);
  background: rgba(96, 165, 250, 0.18);
  pointer-events: none;
  z-index: 10;
}

.velocity-corner {
  height: 112px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  background: #252930;
  text-transform: uppercase;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

.velocity-lane {
  position: relative;
  flex: 0 0 auto;
  height: 112px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  background:
    linear-gradient(to bottom, rgba(255, 255, 255, 0.08), transparent 1px),
    repeating-linear-gradient(to right, rgba(255, 255, 255, 0.04) 0, rgba(255, 255, 255, 0.04) 1px, transparent 1px, transparent 80px),
    #1f2329;
  touch-action: none;
}

.velocity-guide {
  position: absolute;
  left: 6px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.68rem;
  pointer-events: none;
}

.velocity-guide--top {
  top: 5px;
}

.velocity-guide--mid {
  top: 52px;
}

.velocity-bar {
  position: absolute;
  bottom: 8px;
  width: 8px;
  min-height: 3px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.45);
  border-radius: 3px 3px 0 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.32);
  cursor: ns-resize;
}

.velocity-bar.selected {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
  z-index: 3;
}

.velocity-bar.muted {
  filter: grayscale(0.85);
}
</style>
