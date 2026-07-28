<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FreePlayRecordedNote, FreePlayTimeSignature, FreePlayTrack } from '../../stores/freePlayStore'
import type { FreePlayEditorSubdivision } from '../../modules/freePlay/editor/freePlayTrackEditorSnap'
import { quarterNoteUs, snapTimeUs, subdivisionUs } from '../../modules/freePlay/editor/freePlayTrackEditorSnap'
import { clampPitch, editorBeatUs, editorMeasureUs, FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, pitchToY, timeToX, xToTime, yToPitch } from '../../modules/freePlay/editor/freePlayTrackEditorGeometry'

export type FreePlayTrackEditorMode = 'select' | 'draw' | 'marquee'

type InteractionKind = 'idle' | 'dragging-note' | 'resizing-left' | 'resizing-right' | 'drawing-note' | 'marquee-selecting'

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
}

interface DrawableNote extends FreePlayRecordedNote {
  color: string
  trackIndex: number
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
  pixelsPerQuarter: number
  rowHeight: number
}>()

const emit = defineEmits<{
  'update:tracks': [tracks: FreePlayTrack[]]
  'update:selectedNoteIds': [ids: string[]]
  dirty: []
}>()

const gridRef = ref<HTMLElement | null>(null)
const interaction = ref<InteractionState>({ kind: 'idle', pointerId: -1, origin: { x: 0, y: 0, timeUs: 0, noteId: 60 }, snapshots: [] })
let draftNoteCounter = 1

const selectedSet = computed(() => new Set(props.selectedNoteIds))
const snapUnitUs = computed(() => subdivisionUs(props.bpm, props.snapSubdivision))
const defaultNoteDurationUs = computed(() => props.snapEnabled ? snapUnitUs.value : quarterNoteUs(props.bpm) / 4)
const maxEndUs = computed(() => Math.max(0, ...props.tracks.flatMap(track => track.notes.map(note => note.endUs))))
const timelineDurationUs = computed(() => Math.max(quarterNoteUs(props.bpm) * 16, maxEndUs.value + quarterNoteUs(props.bpm) * 4))
const gridWidth = computed(() => Math.ceil(timeToX(timelineDurationUs.value, props.bpm, props.pixelsPerQuarter)))
const gridHeight = computed(() => 128 * props.rowHeight)
const beatUs = computed(() => editorBeatUs(props.bpm, props.timeSignature))
const measureUs = computed(() => editorMeasureUs(props.bpm, props.timeSignature))

const beatLines = computed(() => {
  const lines: { id: string; x: number; measure: boolean }[] = []
  const beat = Math.max(1, beatUs.value)
  const measure = Math.max(1, measureUs.value)
  for (let timeUs = 0; timeUs <= timelineDurationUs.value; timeUs += beat) {
    const measureLine = Math.abs(timeUs / measure - Math.round(timeUs / measure)) < 0.001
    lines.push({ id: `beat:${timeUs}`, x: timeToX(timeUs, props.bpm, props.pixelsPerQuarter), measure: measureLine })
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

const drawableNotes = computed<DrawableNote[]>(() => props.tracks.flatMap((track, trackIndex) => track.notes.map(note => {
  const left = timeToX(note.startUs, props.bpm, props.pixelsPerQuarter)
  const right = timeToX(note.endUs, props.bpm, props.pixelsPerQuarter)
  return {
    ...note,
    color: track.color,
    trackIndex,
    style: {
      left: `${left}px`,
      top: `${pitchToY(note.noteId, props.rowHeight)}px`,
      width: `${Math.max(8, right - left)}px`,
      height: `${Math.max(10, props.rowHeight - 2)}px`,
      backgroundColor: track.color,
    },
  }
})))

function cloneTracks() {
  return props.tracks.map(track => ({ ...track, notes: track.notes.map(note => ({ ...note })) }))
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
  const tracks = cloneTracks()
  for (const snapshot of snapshots) {
    const track = tracks.find(track => track.id === snapshot.trackId)
    const note = track?.notes.find(note => note.id === snapshot.id)
    if (!note) continue
    Object.assign(note, updater(snapshot))
  }
  emitTracks(tracks)
}

function deleteSelected() {
  if (!props.selectedNoteIds.length) return
  const ids = selectedSet.value
  const tracks = cloneTracks().map(track => ({ ...track, notes: track.notes.filter(note => !ids.has(note.id)) }))
  emitTracks(tracks)
  setSelected([])
}

defineExpose({ deleteSelected })

function handleGridPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const point = getPoint(event)
  gridRef.value?.setPointerCapture(event.pointerId)

  if (props.mode === 'draw') {
    const startUs = snapTimeUs(point.timeUs, props.bpm, props.snapSubdivision, props.snapEnabled)
    const note: FreePlayRecordedNote = {
      id: `draft:${draftNoteCounter++}`,
      trackId: props.tracks[0]?.id ?? 1,
      noteId: point.noteId,
      startUs,
      endUs: startUs + Math.max(FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, defaultNoteDurationUs.value),
      velocity: 80,
      source: 'pointer',
    }
    const tracks = cloneTracks()
    const targetTrack = tracks[0]
    if (targetTrack) targetTrack.notes.push(note)
    emitTracks(tracks)
    setSelected([note.id])
    interaction.value = { kind: 'drawing-note', pointerId: event.pointerId, origin: point, anchorNoteId: note.id, snapshots: [{ id: note.id, trackId: note.trackId, startUs, endUs: note.endUs, noteId: point.noteId }] }
    return
  }

  if (props.mode === 'marquee') {
    interaction.value = { kind: 'marquee-selecting', pointerId: event.pointerId, origin: point, snapshots: [], marquee: { left: point.x, top: point.y, width: 0, height: 0 } }
    return
  }

  setSelected([])
}

function handleNotePointerDown(event: PointerEvent, note: DrawableNote) {
  if (event.button !== 0 || props.mode === 'draw' || props.mode === 'marquee') return
  event.stopPropagation()
  const point = getPoint(event)
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
  if (event.button !== 0 || props.mode !== 'select') return
  event.stopPropagation()
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
</script>

<template>
  <div class="track-editor-grid-shell">
    <div class="grid-viewport">
      <div class="editor-canvas" :style="{ width: `${64 + gridWidth}px`, height: `${gridHeight}px` }">
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
          :style="{ left: '64px', width: `${gridWidth}px`, height: `${gridHeight}px`, '--row-height': `${rowHeight}px` }"
          @pointerdown="handleGridPointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
        >
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

.piano-ruler {
  position: sticky;
  left: 0;
  z-index: 20;
  width: 64px;
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
  border-bottom: 1px solid rgba(0, 0, 0, 0.28);
  background: linear-gradient(to bottom, #f4f4f1, #d9d9d4);
  color: #33373d;
  font-size: 0.66rem;
  font-weight: 700;
  pointer-events: none;
}

.piano-key--black {
  left: 0;
  right: 16px;
  z-index: 1;
  border-radius: 0 0 4px 0;
  background: linear-gradient(to bottom, #1a1b1e, #050505);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: inset -2px 0 0 rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.45);
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
  position: absolute;
  top: 0;
  min-width: calc(100% - 64px);
  background-color: #24272c;
  background-image:
    repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 0, rgba(255, 255, 255, 0.035) 1px, transparent 1px, transparent var(--row-height)),
    repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 0, rgba(255, 255, 255, 0.03) calc(var(--row-height) * 12), transparent calc(var(--row-height) * 12), transparent calc(var(--row-height) * 24));
  touch-action: none;
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
</style>
