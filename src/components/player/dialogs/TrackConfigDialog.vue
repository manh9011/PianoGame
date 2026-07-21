<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../../stores/playerStore'
import { isTrackSounded, type TrackMode, type TrackRole } from '../../../modules/game/trackProperties'
import { getEmojiFontFamily, getInstrumentByProgram, getInstrumentEmoji } from '../../../modules/audio/gmInstrumentCatalog'
import BasePopover from './BasePopover.vue'
import ColorPickerDialog from './ColorPickerDialog.vue'
import TrackInstrumentDialog from './TrackInstrumentDialog.vue'

interface Props {
  show: boolean
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right'
}

interface TrackData {
  trackId: number
  instrumentProgram: number
  instrumentName: string
  instrumentEmoji: string
  noteCount: number
  channel: number
  color: string
  mode: TrackMode
  role?: TrackRole
  predominantHand: 'left' | 'right' | 'background'
}

const props = defineProps<Props>()

const { t } = useI18n()
const player = usePlayerStore()
const emojiStyle = { fontFamily: getEmojiFontFamily() }

const showColorPicker = ref(false)
const showInstrumentDialog = ref(false)
const selectedTrackId = ref<number | null>(null)
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
      instrumentEmoji: getInstrumentEmoji(instrument),
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

function handleInstrumentSelect(program: number) {
  if (selectedTrackId.value !== null) player.setTrackInstrument(selectedTrackId.value, program)
}

function handleColorSelect(color: string) {
  if (selectedTrackId.value !== null) player.setTrackColor(selectedTrackId.value, color)
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
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="props.popupStyle"
    :arrow-style="props.arrowStyle"
    :arrow-placement="props.arrowPlacement"
    width="420px"
    @close="closeDialogs"
  >
    <div class="track-config-dialog">
      <div>
        <h3 class="dialog-title">{{ t('trackSettings.dialogTitle') }}</h3>
        <p class="dialog-subtitle">{{ t('trackSettings.dialogSubtitle') }}</p>
      </div>

      <div class="track-list">
        <section
          v-for="track in tracksData"
          :key="track.trackId"
          class="track-card"
          :style="{ '--track-color': track.color }"
        >
          <div class="track-accent"></div>

          <div class="track-card-header">
            <button class="track-icon" :title="t('trackSettings.selectInstrument')" @click="(event) => openInstrumentDialog(event, track.trackId)">
              <span class="track-emoji-wrap">
                <span class="track-emoji" :style="emojiStyle">{{ track.instrumentEmoji }}</span>
              </span>
            </button>
            <div class="track-info">
              <div class="instrument-name">{{ track.instrumentName }}</div>
              <div class="track-meta">{{ t('trackSettings.notes', { count: track.noteCount }) }} • {{ t('trackSettings.channel', { number: track.channel + 1 }) }}</div>
            </div>
          </div>

          <div class="track-controls">
            <button class="control-btn disabled" type="button" disabled>
              <i :class="[track.predominantHand === 'background' ? 'fas fa-cog' : 'fas fa-hand-paper', { flipped: track.predominantHand === 'left' }]" />
              <span>{{ t(roleLabelKeys[track.predominantHand]) }}</span>
            </button>
            <button class="control-btn" type="button" @click="(event) => openColorPicker(event, track.trackId)">
              <span class="keyboard-icon" :style="{ color: track.color }"><i class="fas fa-keyboard"></i></span>
              <span>{{ colorName(track.color) }}</span>
            </button>
            <button class="control-btn" :class="{ muted: !isSounded(track.mode), danger: !isSounded(track.mode) }" type="button" @click="toggleSound(track.trackId)">
              <i :class="isSounded(track.mode) ? 'fas fa-volume-up' : 'fas fa-times'" />
              <span>{{ isSounded(track.mode) ? t('trackSettings.sounded') : t('trackSettings.muted') }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>

    <TrackInstrumentDialog
      :show="showInstrumentDialog"
      :current-program="currentTrack?.instrumentProgram ?? 0"
      :popup-style="nestedPopupStyle"
      :arrow-style="nestedArrowStyle"
      :arrow-placement="nestedArrowPlacement"
      @select="handleInstrumentSelect"
      @close="closeDialogs"
    />

    <ColorPickerDialog
      :show="showColorPicker"
      :current-color="currentTrack?.color ?? ''"
      :popup-style="nestedPopupStyle"
      :arrow-style="nestedArrowStyle"
      :arrow-placement="nestedArrowPlacement"
      @select="handleColorSelect"
      @close="closeDialogs"
    />
  </BasePopover>
</template>

<style scoped>
.track-config-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.dialog-title {
  margin: 0;
  color: #f3f4f6;
  font-size: 1.1rem;
}

.dialog-subtitle {
  margin: 0.3rem 0 0;
  color: #9ca3af;
  font-size: 0.85rem;
}

.track-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.track-card {
  --track-color: #729fcf;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--track-color) 86%, #ffffff 3%), color-mix(in srgb, var(--track-color) 70%, #000000 18%));
  box-shadow:
    0 2px 0 rgba(255, 255, 255, 0.18) inset,
    0 -1px 0 rgba(0, 0, 0, 0.26) inset,
    0 10px 18px rgba(0, 0, 0, 0.22);
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

.track-icon {
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.track-icon:hover {
  background: rgba(0, 0, 0, 0.28);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2em;
  height: 1.2em;
  font-size: 1.45rem;
  line-height: 1;
  text-align: center;
  transform: translate(-1px, 0);
  pointer-events: none;
  user-select: none;
}

.track-icon:hover .track-emoji,
.track-icon:focus-visible .track-emoji {
  transform: translate(-1px, 0) scale(1.02);
}

.track-info {
  min-width: 0;
}

.instrument-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.22rem;
  font-weight: 400;
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}

.track-meta {
  margin-top: 2px;
  font-size: 0.86rem;
  color: rgba(255, 255, 255, 0.88);
}

.track-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid rgba(0, 0, 0, 0.22);
}

.control-btn {
  min-height: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.22);
  background: rgba(0, 0, 0, 0.06);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease;
  border-radius: 0;
}

.control-btn:last-child {
  border-right: 0;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.control-btn i {
  font-size: 1.55rem;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.28));
}

.control-btn i.flipped {
  transform: scaleX(-1);
}

.control-btn span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
  font-size: 0.82rem;
}

.keyboard-icon {
  display: block;
  line-height: 1;
  filter: brightness(1.3) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}

.control-btn.muted {
  opacity: 0.76;
}

.control-btn.danger i,
.control-btn.danger span {
  color: #ef4444;
}

.control-btn.disabled {
  cursor: not-allowed;
  opacity: 0.82;
  background: rgba(0, 0, 0, 0.12);
}

.control-btn.disabled:hover {
  background: rgba(0, 0, 0, 0.12);
}

@media (max-width: 560px) {
  .track-controls {
    grid-template-columns: 1fr;
  }

  .control-btn {
    border-right: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.22);
  }

  .control-btn:last-child {
    border-bottom: 0;
  }
}
</style>
