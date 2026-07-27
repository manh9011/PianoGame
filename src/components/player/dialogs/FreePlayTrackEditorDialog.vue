<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirmDialog } from '../../../composables/useConfirmDialog'
import { getInstrumentByProgram } from '../../../modules/audio/gmInstrumentCatalog'
import { FREE_PLAY_EDITOR_SUBDIVISIONS, type FreePlayEditorSubdivision } from '../../../modules/freePlay/editor/freePlayTrackEditorSnap'
import { useFreePlayStore, type FreePlayTrack } from '../../../stores/freePlayStore'
import FreePlayTrackEditorGrid, { type FreePlayTrackEditorMode } from '../FreePlayTrackEditorGrid.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { confirm } = useConfirmDialog()
const freePlay = useFreePlayStore()

const gridRef = ref<{ deleteSelected: () => void } | null>(null)
const draftTracks = ref<FreePlayTrack[]>([])
const selectedNoteIds = ref<string[]>([])
const mode = ref<FreePlayTrackEditorMode>('select')
const snapEnabled = ref(true)
const snapSubdivision = ref<FreePlayEditorSubdivision>('1/16')
const pixelsPerQuarter = ref(80)
const rowHeight = ref(18)
const dirty = ref(false)

const selectedCount = computed(() => selectedNoteIds.value.length)
const noteCount = computed(() => draftTracks.value.reduce((total, track) => total + track.notes.length, 0))
const modeHintKey = computed(() => {
  if (mode.value === 'draw') return 'freePlay.trackEditorDrawHint'
  if (mode.value === 'marquee') return 'freePlay.trackEditorMarqueeHint'
  return 'freePlay.trackEditorSelectHint'
})

const modeButtons = computed<{ mode: FreePlayTrackEditorMode; label: string; icon: string }[]>(() => [
  { mode: 'select', label: t('freePlay.trackEditorSelectMode'), icon: 'fas fa-arrow-pointer' },
  { mode: 'draw', label: t('freePlay.trackEditorDrawMode'), icon: 'fas fa-pen' },
  { mode: 'marquee', label: t('freePlay.trackEditorMarqueeMode'), icon: 'fas fa-vector-square' },
])

function cloneTracks(tracks: FreePlayTrack[]) {
  return tracks.map(track => ({ ...track, notes: track.notes.map(note => ({ ...note })) }))
}

function resetDraft() {
  draftTracks.value = cloneTracks(freePlay.tracks)
  selectedNoteIds.value = []
  mode.value = 'select'
  dirty.value = false
}

function markDirty() {
  dirty.value = true
}

function updateDraftTracks(tracks: FreePlayTrack[]) {
  draftTracks.value = tracks
}

function deleteSelection() {
  gridRef.value?.deleteSelected()
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
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    tone: 'danger',
  })
  if (confirmed) emit('close')
}

function save() {
  freePlay.replaceTrackEditorNotes(draftTracks.value)
  dirty.value = false
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.show) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (!selectedNoteIds.value.length) return
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
  if (!show) return
  resetDraft()
  await nextTick()
}, { immediate: true })
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
          <div class="title-block">
            <h2>{{ t('freePlay.trackEditorTitle') }}</h2>
            <p>{{ t(modeHintKey) }}</p>
          </div>

          <div class="editor-toolbar" :aria-label="t('freePlay.trackEditorToolbar')">
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
                class="tool-button tool-button--text"
                :class="{ active: snapEnabled }"
                :aria-pressed="snapEnabled"
                :title="t('freePlay.trackEditorSnap')"
                @click="snapEnabled = !snapEnabled"
              >
                {{ snapEnabled ? t('freePlay.trackEditorSnapOn') : t('freePlay.trackEditorSnapOff') }}
              </button>
              <label class="select-label">
                <span>{{ t('freePlay.trackEditorSubdivision') }}</span>
                <select v-model="snapSubdivision" class="subdivision-select">
                  <option v-for="option in FREE_PLAY_EDITOR_SUBDIVISIONS" :key="option" :value="option">{{ option }}</option>
                </select>
              </label>
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
            <button class="action-button secondary" @click="requestClose">{{ t('common.cancel') }}</button>
            <button class="action-button primary" @click="save">{{ t('common.save') }}</button>
            <button class="close-button" :aria-label="t('common.close')" @click="requestClose">✕</button>
          </div>
        </header>

        <main class="track-editor-body">
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
            :pixels-per-quarter="pixelsPerQuarter"
            :row-height="rowHeight"
            @update:tracks="updateDraftTracks"
            @update:selected-note-ids="selectedNoteIds = $event"
            @dirty="markDirty"
          />
        </main>

        <footer class="track-editor-footer">
          <div class="status-line">
            <span>{{ t('freePlay.trackEditorSelectedCount', { count: selectedCount }) }}</span>
            <span>{{ t('freePlay.trackEditorTracksCount', { count: draftTracks.length }) }}</span>
            <span v-if="dirty" class="dirty-indicator">{{ t('freePlay.trackEditorUnsavedChanges') }}</span>
          </div>
          <div class="track-legend" :aria-label="t('freePlay.trackEditorLegend')">
            <span v-for="(track, index) in draftTracks" :key="track.id" class="track-chip">
              <span class="track-color" :style="{ backgroundColor: track.color }"></span>
              {{ t('freePlay.trackNumber', { number: index + 1, instrument: getInstrumentByProgram(track.instrumentProgram).name }) }}
            </span>
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
  padding: 12px;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(3px);
}

.track-editor-shell {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  background: #2b2d31;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.48);
  overflow: hidden;
}

.track-editor-header {
  display: grid;
  grid-template-columns: minmax(210px, 1fr) auto auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.18);
}

.title-block h2 {
  margin: 0;
  color: #f3f4f6;
  font-size: 1.15rem;
}

.title-block p {
  margin: 0.2rem 0 0;
  color: #aeb4bf;
  font-size: 0.84rem;
}

.editor-toolbar,
.tool-group,
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
  gap: 0.55rem;
  justify-content: center;
}

.tool-group {
  gap: 0.35rem;
  padding: 0.25rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tool-button {
  min-width: 34px;
  height: 34px;
  padding: 0 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
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
  min-width: 74px;
  font-weight: 700;
}

.select-label {
  gap: 0.35rem;
  color: #d1d5db;
  font-size: 0.8rem;
}

.subdivision-select {
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: #1f2329;
  color: #f3f4f6;
}

.dialog-actions {
  gap: 0.5rem;
  justify-content: flex-end;
}

.action-button {
  min-height: 34px;
  padding: 0 0.8rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f3f4f6;
  cursor: pointer;
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.06);
}

.action-button.primary {
  background: #2563eb;
  border-color: rgba(147, 197, 253, 0.5);
}

.close-button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 1.35rem;
  cursor: pointer;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f3f4f6;
}

.track-editor-body {
  position: relative;
  min-height: 0;
  padding: 0.75rem;
  overflow: hidden;
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
