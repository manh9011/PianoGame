<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../../stores/playerStore'
import { isTrackSounded, type TrackMode, type TrackRole } from '../../../modules/game/trackProperties'
import { getInstrumentByProgram, getInstrumentImageUrl } from '../../../modules/audio/gmInstrumentCatalog'
import ColorPickerDialog from '../dialogs/ColorPickerDialog.vue'
import TrackInstrumentDialog from '../dialogs/TrackInstrumentDialog.vue'
import TrackRoleDialog from '../dialogs/TrackRoleDialog.vue'

interface Props {
  allowRoleEdit?: boolean
  variant?: 'standalone' | 'dialog'
}

const props = withDefaults(defineProps<Props>(), {
  allowRoleEdit: false,
  variant: 'dialog',
})

export type DragType = 'instrument' | 'role' | 'color' | 'mode'

const emit = defineEmits<{
  (e: 'drag-start', type: DragType, value: any, trackId: number): void
  (e: 'drag-end'): void
}>()

interface TrackData {
  trackId: number
  instrumentProgram: number
  instrumentName: string
  instrumentImageUrl: string
  noteCount: number
  channel: number
  color: string
  mode: TrackMode
  role?: TrackRole
  predominantHand: 'left' | 'right' | 'background'
}

const { t } = useI18n()
const player = usePlayerStore()

const showColorPicker = ref(false)
const showInstrumentDialog = ref(false)
const showRoleDialog = ref(false)
const selectedTrackId = ref<number | null>(null)
const draggedOverTrackId = ref<number | null>(null)
const nestedPopupStyle = ref({ top: '0px', left: '0px' })
const nestedArrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const nestedArrowPlacement = ref<'left' | 'right'>('right')

const tracksData = computed<TrackData[]>(() => {
  if (!player.session) return []

  return player.session.tracks.map(track => {
    const trackNotes = player.session!.notes.filter(note => note.trackId === track.trackId)
    const instrument = getInstrumentByProgram(track.instrumentProgram)
    const hands = trackNotes.filter(note => note.hand).map(note => note.hand)
    const leftCount = hands.filter(hand => hand === 'left').length
    const rightCount = hands.filter(hand => hand === 'right').length

    let predominantHand: TrackData['predominantHand']
    if (track.role === 'background') {
      predominantHand = 'background'
    } else if (track.handAssignment !== undefined) {
      predominantHand = track.handAssignment
    } else if (leftCount > 0 && rightCount > 0) {
      predominantHand = 'background'
    } else {
      predominantHand = leftCount > rightCount ? 'left' : 'right'
    }

    return {
      trackId: track.trackId,
      instrumentProgram: instrument.program,
      instrumentName: instrument.name,
      instrumentImageUrl: getInstrumentImageUrl(instrument.program),
      noteCount: trackNotes.length,
      channel: trackNotes[0]?.channel ?? 0,
      color: track.color,
      mode: track.mode,
      role: track.role,
      predominantHand,
    }
  })
})

const currentTrack = computed(() => selectedTrackId.value === null
  ? null
  : player.session?.tracks.find(track => track.trackId === selectedTrackId.value) ?? null)

const roleLabelKeys: Record<TrackData['predominantHand'], string> = {
  left: 'trackSettings.left',
  right: 'trackSettings.right',
  background: 'trackSettings.background',
}

const colorLabelKeys: Record<string, string> = {
  '#729fcf': 'trackSettings.blue',
  '#4e9a06': 'trackSettings.green',
  '#8ae234': 'trackSettings.green',
  '#f57900': 'trackSettings.orange',
  '#fce94f': 'trackSettings.yellow',
  '#ad7fa8': 'trackSettings.purple',
  '#ef2929': 'trackSettings.red',
}

function colorName(color: string) {
  return t(colorLabelKeys[color.toLowerCase()] ?? 'trackSettings.color')
}

function positionPopup(event: MouseEvent, width: number, height: number) {
  const element = event.currentTarget as HTMLElement
  const rect = element.getBoundingClientRect()
  const margin = 10
  const gap = 8

  let left = rect.left - width - gap
  let top = rect.top
  let arrowOnRight = true

  if (left < margin) {
    left = rect.right + gap
    arrowOnRight = false
  }

  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - width - margin
  }

  if (top < margin) top = margin
  if (top + height > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - height - margin)
  }

  const arrowTop = Math.max(18, Math.min(height - 18, rect.top + rect.height / 2 - top))
  nestedPopupStyle.value = { top: `${top}px`, left: `${left}px` }
  nestedArrowStyle.value = arrowOnRight ? { top: `${arrowTop}px`, right: '-9px' } : { top: `${arrowTop}px`, left: '-9px' }
  nestedArrowPlacement.value = arrowOnRight ? 'right' : 'left'
}

function closeDialogs() {
  showColorPicker.value = false
  showInstrumentDialog.value = false
  showRoleDialog.value = false
  selectedTrackId.value = null
}

function openInstrumentDialog(event: MouseEvent, trackId: number) {
  closeDialogs()
  selectedTrackId.value = trackId
  positionPopup(event, 500, 520)
  showInstrumentDialog.value = true
}

function openColorPicker(event: MouseEvent, trackId: number) {
  closeDialogs()
  selectedTrackId.value = trackId
  positionPopup(event, 88, 392)
  showColorPicker.value = true
}

function openRoleDialog(event: MouseEvent, trackId: number) {
  if (!props.allowRoleEdit) return
  closeDialogs()
  selectedTrackId.value = trackId
  positionPopup(event, 290, 220)
  showRoleDialog.value = true
}

function handleInstrumentSelect(program: number) {
  if (selectedTrackId.value !== null) player.setTrackInstrument(selectedTrackId.value, program)
}

function handleColorSelect(color: string) {
  if (selectedTrackId.value !== null) player.setTrackColor(selectedTrackId.value, color)
}

function handleRoleSelect(role: TrackRole) {
  if (selectedTrackId.value !== null) player.setTrackRole(selectedTrackId.value, role)
}

function toggleSound(trackId: number) {
  const track = player.session?.tracks.find(item => item.trackId === trackId)
  if (!track) return

  if (track.mode === 'playedAutomatically' || track.mode === 'youPlay') {
    player.setTrackMode(trackId, 'notPlayed')
  } else {
    player.setTrackMode(trackId, track.role === 'background' ? 'playedAutomatically' : 'youPlay')
  }
}

function isSounded(mode: TrackMode) {
  return isTrackSounded(mode)
}

function createCustomGhost(event: DragEvent, text: string, iconHtml: string, color: string) {
  if (!event.dataTransfer) return

  const ghost = document.createElement('div')
  ghost.style.position = 'fixed'
  ghost.style.top = '-1000px'
  ghost.style.left = '-1000px'
  ghost.style.padding = '8px 14px'
  ghost.style.borderRadius = '10px'
  ghost.style.background = color || '#2e3436'
  ghost.style.color = '#ffffff'
  ghost.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.45)'
  ghost.style.display = 'flex'
  ghost.style.alignItems = 'center'
  ghost.style.gap = '8px'
  ghost.style.fontFamily = 'sans-serif'
  ghost.style.fontSize = '0.9rem'
  ghost.style.fontWeight = '600'
  ghost.style.border = '1px solid rgba(255, 255, 255, 0.3)'
  ghost.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.8)'
  ghost.style.pointerEvents = 'none'

  ghost.innerHTML = `${iconHtml}<span>${text}</span>`
  document.body.appendChild(ghost)

  event.dataTransfer.setDragImage(ghost, 20, 20)

  setTimeout(() => {
    ghost.remove()
  }, 0)
}

function onDragStart(event: DragEvent, type: DragType, value: any, track: TrackData) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    const payload = JSON.stringify({ type, value, trackId: track.trackId })
    event.dataTransfer.setData('application/json', payload)
    event.dataTransfer.setData('text/plain', payload)

    let text = ''
    let iconHtml = ''
    if (type === 'instrument') {
      text = track.instrumentName
      iconHtml = `<img src="${track.instrumentImageUrl}" style="width: 24px; height: 24px; vertical-align: middle; object-fit: contain;" />`
    } else if (type === 'role') {
      text = t(roleLabelKeys[track.predominantHand])
      const iconClass = track.predominantHand === 'background' ? 'fas fa-cog' : 'fas fa-hand-paper'
      const flipped = track.predominantHand === 'left' ? 'display: inline-block; transform: scaleX(-1);' : ''
      iconHtml = `<i class="${iconClass}" style="${flipped}"></i>`
    } else if (type === 'color') {
      text = colorName(track.color)
      iconHtml = `<i class="fas fa-keyboard"></i>`
    } else if (type === 'mode') {
      const sounded = isSounded(track.mode)
      text = sounded ? t('trackSettings.sounded') : t('trackSettings.muted')
      iconHtml = `<i class="${sounded ? 'fas fa-volume-up' : 'fas fa-times'}"></i>`
    }

    createCustomGhost(event, text, iconHtml, track.color)
  }
  emit('drag-start', type, value, track.trackId)
}

function onDragEnd() {
  draggedOverTrackId.value = null
  emit('drag-end')
}

let dragTimeout: number | undefined

function handleDragOver(trackId: number) {
  clearTimeout(dragTimeout)
  draggedOverTrackId.value = trackId
}

function handleDragLeave(trackId: number) {
  if (draggedOverTrackId.value === trackId) {
    dragTimeout = window.setTimeout(() => {
      draggedOverTrackId.value = null
    }, 50)
  }
}

function handleDrop(event: DragEvent, targetTrackId: number) {
  event.preventDefault()
  draggedOverTrackId.value = null
  const jsonStr = event.dataTransfer?.getData('application/json') || event.dataTransfer?.getData('text/plain')
  if (!jsonStr) return
  try {
    const data = JSON.parse(jsonStr)
    if (!data || !data.type) return
    const { type, value } = data
    if (type === 'instrument') {
      player.setTrackInstrument(targetTrackId, Number(value))
    } else if (type === 'role') {
      player.setTrackRole(targetTrackId, value)
    } else if (type === 'color') {
      player.setTrackColor(targetTrackId, value)
    } else if (type === 'mode') {
      player.setTrackMode(targetTrackId, value)
    }
  } catch (e) {
    const program = parseInt(jsonStr, 10)
    if (!isNaN(program)) {
      player.setTrackInstrument(targetTrackId, program)
    }
  }
}
</script>

<template>
  <div :class="['track-config-panel', `track-config-panel--${variant}`]">
    <!-- Dialog mode: show title/subtitle -->
    <div v-if="variant === 'dialog'">
      <h3 class="dialog-title">{{ t('trackSettings.dialogTitle') }}</h3>
      <p class="dialog-subtitle">{{ t('trackSettings.dialogSubtitle') }}</p>
    </div>

    <div :class="variant === 'standalone' ? 'track-grid' : 'track-list'">
      <section v-for="track in tracksData" :key="track.trackId" class="track-card"
        :class="{ 'drag-over': draggedOverTrackId === track.trackId }"
        :style="{ '--track-color': track.color }"
        @dragover.prevent="handleDragOver(track.trackId)"
        @dragleave.prevent="handleDragLeave(track.trackId)"
        @drop="(event) => handleDrop(event, track.trackId)">
        <div class="track-accent"></div>

        <div class="track-card-header">
          <button class="track-icon" :title="t('trackSettings.selectInstrument')"
            draggable="true"
            @dragstart="(event) => onDragStart(event, 'instrument', track.instrumentProgram, track)"
            @dragend="onDragEnd"
            @click="(event) => openInstrumentDialog(event, track.trackId)">
            <span class="track-emoji-wrap">
              <img class="track-emoji" :src="track.instrumentImageUrl" :alt="track.instrumentName" />
            </span>
          </button>
          <div class="track-info">
            <div class="instrument-name">{{ track.instrumentName }}</div>
            <div class="track-meta">{{ t('trackSettings.notes', { count: track.noteCount }) }} • {{
              t('trackSettings.channel', { number: track.channel + 1 }) }}</div>
          </div>
          <!-- Play preview button shown only in standalone mode -->
          <button v-if="variant === 'standalone'" class="track-play-btn" :title="t('trackSettings.preview')"
            @click.stop="player.toggleTrackPreview(track.trackId)">
            <i :class="player.trackPreviewTrackId === track.trackId && player.trackPreviewRunning ? 'fas fa-stop' : 'fas fa-play'" />
          </button>
        </div>

        <div class="track-controls">
          <button class="control-btn" :class="{ disabled: !allowRoleEdit }" type="button" :disabled="!allowRoleEdit"
            draggable="true"
            @dragstart="(event) => onDragStart(event, 'role', track.role, track)"
            @dragend="onDragEnd"
            @click="(event) => openRoleDialog(event, track.trackId)">
            <i
              :class="[track.predominantHand === 'background' ? 'fas fa-cog' : 'fas fa-hand-paper', { flipped: track.predominantHand === 'left' }]" />
            <span>{{ t(roleLabelKeys[track.predominantHand]) }}</span>
          </button>
          <button class="control-btn" type="button"
            draggable="true"
            @dragstart="(event) => onDragStart(event, 'color', track.color, track)"
            @dragend="onDragEnd"
            @click="(event) => openColorPicker(event, track.trackId)">
            <span class="keyboard-icon"><i class="fas fa-keyboard"></i></span>
            <span>{{ colorName(track.color) }}</span>
          </button>
          <button class="control-btn" :class="{ muted: !isSounded(track.mode), danger: !isSounded(track.mode) }"
            type="button"
            draggable="true"
            @dragstart="(event) => onDragStart(event, 'mode', track.mode, track)"
            @dragend="onDragEnd"
            @click="toggleSound(track.trackId)">
            <i :class="isSounded(track.mode) ? 'fas fa-volume-up' : 'fas fa-times'" />
            <span>{{ isSounded(track.mode) ? t('trackSettings.sounded') : t('trackSettings.muted') }}</span>
          </button>
        </div>
      </section>
    </div>

    <TrackInstrumentDialog :show="showInstrumentDialog" :current-program="currentTrack?.instrumentProgram ?? 0"
      :popup-style="nestedPopupStyle" :arrow-style="nestedArrowStyle" :arrow-placement="nestedArrowPlacement"
      @select="handleInstrumentSelect" @close="closeDialogs" />

    <TrackRoleDialog :show="showRoleDialog" :current-role="currentTrack?.role" :popup-style="nestedPopupStyle"
      :arrow-style="nestedArrowStyle" :arrow-placement="nestedArrowPlacement" @select="handleRoleSelect"
      @close="closeDialogs" />

    <ColorPickerDialog :show="showColorPicker" :current-color="currentTrack?.color ?? ''"
      :popup-style="nestedPopupStyle" :arrow-style="nestedArrowStyle" :arrow-placement="nestedArrowPlacement"
      @select="handleColorSelect" @close="closeDialogs" />
  </div>
</template>

<style scoped>
/* ── Shared panel wrapper ─────────────────────────────────────────── */
.track-config-panel {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.track-config-panel--standalone {
  width: 100%;
}

/* ── Standalone: horizontal wrapping grid ───────────────────────── */
.track-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  align-content: flex-start;
}

.track-config-panel--standalone .track-card {
  width: 320px;
  flex: 0 0 320px;
}

/* ── Dialog: vertical list (unchanged) ──────────────────────────── */
.track-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialog-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.1rem;
}

.dialog-subtitle {
  margin: 0.3rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

/* (track-list now defined in the block above) */

.track-card {
  --track-color: #729fcf;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  background-color: var(--track-color);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(0, 0, 0, 0.15) 100%);
  box-shadow:
    0 2px 0 rgba(255, 255, 255, 0.18) inset,
    0 -1px 0 rgba(0, 0, 0, 0.26) inset,
    0 10px 18px rgba(0, 0, 0, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.track-card.drag-over {
  transform: scale(1.05);
  box-shadow: 
    0 0 0 4px #fce94f,
    0 15px 25px rgba(0, 0, 0, 0.35);
  z-index: 10;
}

.track-accent {
  height: 3px;
  background: rgba(255, 255, 255, 0.36);
}

.track-card-header {
  display: grid;
  grid-template-columns: 54px 1fr;
  align-items: center;
  gap: 8px;
  min-height: 68px;
  padding: 10px 12px 8px;
}

/* Standalone: make room for the play button on the right */
.track-config-panel--standalone .track-card-header {
  grid-template-columns: 54px 1fr auto;
}

.track-play-btn {
  padding: 0 4px;
  border: none;
  background: transparent;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.6rem;
  transition: transform 0.1s ease, color 0.1s ease;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 1px 8px rgba(0, 0, 0, 0.6);
}

.track-play-btn:hover {
  transform: scale(1.1);
  color: #fff;
}

.track-icon {
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 
    inset 0 3px 6px rgba(0, 0, 0, 0.3),
    inset 0 1px 3px rgba(0, 0, 0, 0.4),
    0 1px 0 rgba(255, 255, 255, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.track-icon:hover {
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 
    inset 0 3px 6px rgba(0, 0, 0, 0.35),
    inset 0 1px 3px rgba(0, 0, 0, 0.5),
    0 1px 0 rgba(255, 255, 255, 0.15);
}

.track-emoji-wrap {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 42px;
  pointer-events: none;
}

.track-emoji {
  width: 38px;
  height: 38px;
  object-fit: contain;
  transform: scale(1.35);
  pointer-events: none;
  user-select: none;
}

.track-info {
  min-width: 0;
}

.instrument-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ffffff;
  font-size: 1.02rem;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 1px 8px rgba(0, 0, 0, 0.6);
}

.track-meta {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.8rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 1px 5px rgba(0, 0, 0, 0.6);
}

.track-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  padding: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 64px;
  padding: 8px 4px 6px;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.2;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  box-shadow: none;
  border-right: 1px solid rgba(0, 0, 0, 0.25);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 1px 5px rgba(0, 0, 0, 0.6);
}

.control-btn:last-child {
  border-right: none;
}

.control-btn:not(:first-child) {
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.12);
}

.control-btn.disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.control-btn:not(.disabled):hover {
  background: rgba(0, 0, 0, 0.12);
}

.control-btn.muted {
  color: #fecaca;
}

.control-btn i,
.control-btn .keyboard-icon i {
  font-size: 1.35rem;
  line-height: 1;
}

.keyboard-icon {
  display: inline-flex;
  font-size: 1.35rem;
  line-height: 1;
  align-items: center;
  justify-content: center;
}

.flipped {
  transform: scaleX(-1);
}
</style>

