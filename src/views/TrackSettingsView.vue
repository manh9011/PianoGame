<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/playerStore'
import { useSettingsStore } from '../stores/settingsStore'
import { isTrackSounded, type TrackMode, type TrackRole } from '../modules/game/trackProperties'
import { getEmojiFontFamily, getInstrumentByProgram, getInstrumentEmoji } from '../modules/audio/gmInstrumentCatalog'
import ColorPickerDialog from '../components/player/dialogs/ColorPickerDialog.vue'
import TrackInstrumentDialog from '../components/player/dialogs/TrackInstrumentDialog.vue'
import TrackRoleDialog from '../components/player/dialogs/TrackRoleDialog.vue'

const router = useRouter()
const player = usePlayerStore()
const settings = useSettingsStore()

const showColorPicker = ref(false)
const showInstrumentDialog = ref(false)
const showRoleDialog = ref(false)
const selectedTrackId = ref<number | null>(null)
const popupStyle = ref({ top: '0px', left: '0px' })
const arrowStyle = ref<{ top: string; left?: string; right?: string }>({ top: '0px', right: '-7px' })
const arrowPlacement = ref<'left' | 'right'>('right')

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
  predominantHand: 'left' | 'right' | 'both' | 'background'
}

const emojiStyle = { fontFamily: getEmojiFontFamily() }

const tracksData = computed<TrackData[]>(() => {
  if (!player.session) return []

  return player.session.tracks.map(track => {
    const trackNotes = player.session!.notes.filter(n => n.trackId === track.trackId)
    const noteCount = trackNotes.length
    const channel = trackNotes[0]?.channel ?? 0
    const hands = trackNotes.filter(n => n.hand).map(n => n.hand)
    const leftCount = hands.filter(h => h === 'left').length
    const rightCount = hands.filter(h => h === 'right').length
    const instrument = getInstrumentByProgram(track.instrumentProgram)

    let predominantHand: TrackData['predominantHand']
    if (track.role === 'background') {
      predominantHand = 'background'
    } else if (track.handAssignment !== undefined) {
      predominantHand = track.handAssignment
    } else {
      predominantHand = leftCount > 0 && rightCount > 0 ? 'both' : leftCount > rightCount ? 'left' : 'right'
    }

    return {
      trackId: track.trackId,
      instrumentProgram: instrument.program,
      instrumentName: instrument.name,
      instrumentEmoji: getInstrumentEmoji(instrument),
      noteCount,
      channel,
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

function back() {
  player.stopTrackPreview()
  router.push(`/mode-select/${player.song?.hash}`)
}

if (!player.session || !player.song) {
  router.replace('/mode-select')
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
  popupStyle.value = { top: `${top}px`, left: `${left}px` }
  arrowStyle.value = arrowOnRight ? { top: `${arrowTop}px`, right: '-9px' } : { top: `${arrowTop}px`, left: '-9px' }
  arrowPlacement.value = arrowOnRight ? 'right' : 'left'
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
  positionPopup(event, 68, 330)
  showColorPicker.value = true
}

function openRoleDialog(event: MouseEvent, trackId: number) {
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
  const track = player.session?.tracks.find(t => t.trackId === trackId)
  if (!track) return

  if (track.mode === 'playedAutomatically' || track.mode === 'youPlay') {
    player.setTrackMode(trackId, 'notPlayed')
  } else {
    player.setTrackMode(trackId, track.role === 'background' ? 'playedAutomatically' : 'youPlay')
  }
}

function playTrack(trackId: number) {
  void player.toggleTrackPreview(trackId, settings.midiOutputId)
}

function reset() {
  player.stopTrackPreview()
}

function autoColor() {
  const fallbackColors = ['#f57900', '#fce94f', '#ad7fa8', '#ef2929']
  let fallbackIndex = 0

  tracksData.value.forEach(track => {
    let color: string

    if (track.predominantHand === 'left') {
      color = '#729fcf'
    } else if (track.predominantHand === 'right') {
      color = '#4e9a06'
    } else {
      color = fallbackColors[fallbackIndex % fallbackColors.length]
      fallbackIndex += 1
    }

    player.setTrackColor(track.trackId, color)
  })
}

const roleLabels: Record<TrackData['predominantHand'], string> = {
  left: 'Left Hand',
  right: 'Right Hand',
  both: 'Both Hands',
  background: 'Background',
}

const colorLabels: Record<string, string> = {
  '#729fcf': 'Blue',
  '#4e9a06': 'Green',
  '#8ae234': 'Green',
  '#f57900': 'Orange',
  '#fce94f': 'Yellow',
  '#ad7fa8': 'Purple',
  '#ef2929': 'Red',
}

function colorName(color: string) {
  return colorLabels[color.toLowerCase()] ?? 'Color'
}

function isSounded(mode: TrackMode): boolean {
  return isTrackSounded(mode)
}

function isPreviewing(trackId: number) {
  return player.trackPreviewTrackId === trackId && player.trackPreviewRunning
}

onBeforeUnmount(() => player.stopTrackPreview())
</script>

<template>
  <section class="track-settings-wrap">
    <header class="track-header">
      <div class="header-left">
        <button class="header-btn" @click="back">Back</button>
        <button class="header-btn">Help</button>
      </div>
      <h1 class="track-title">Hands, Colors, and Instruments</h1>
    </header>

    <main class="tracks-container">
      <div
        v-for="track in tracksData"
        :key="track.trackId"
        class="track-card"
        :style="{ '--track-color': track.color }"
      >
        <div class="track-accent"></div>
        <div class="track-card-header">
          <button class="track-icon" title="Chọn nhạc cụ" @click="(e) => openInstrumentDialog(e, track.trackId)">
            <span class="track-emoji-wrap">
              <span class="track-emoji" :style="emojiStyle">{{ track.instrumentEmoji }}</span>
            </span>
          </button>
          <div class="track-info">
            <div class="instrument-name">{{ track.instrumentName }}</div>
            <div class="track-meta">{{ track.noteCount }} notes • Channel {{ track.channel + 1 }}</div>
          </div>
          <button class="play-btn" :class="{ active: isPreviewing(track.trackId) }" @click="playTrack(track.trackId)">
            <i :class="isPreviewing(track.trackId) ? 'fas fa-stop' : 'fas fa-play'"></i>
          </button>
        </div>

        <div class="track-controls">
          <button class="control-btn wide" @click="(e) => openRoleDialog(e, track.trackId)">
            <i :class="[track.predominantHand === 'background' ? 'fas fa-cog' : 'fas fa-hand-paper', { flipped: track.predominantHand === 'left' }]"></i>
            <span>{{ roleLabels[track.predominantHand] }}</span>
          </button>
          <button class="control-btn" @click="(e) => openColorPicker(e, track.trackId)">
            <span class="keyboard-icon" :style="{ color: track.color }"><i class="fas fa-keyboard"></i></span>
            <span>{{ colorName(track.color) }}</span>
          </button>
          <button class="control-btn" :class="{ muted: !isSounded(track.mode) }" @click="toggleSound(track.trackId)">
            <i :class="isSounded(track.mode) ? 'fas fa-volume-up' : 'fas fa-volume-mute'"></i>
            <span>{{ isSounded(track.mode) ? 'Sounded' : 'Muted' }}</span>
          </button>
        </div>
      </div>
    </main>

    <footer class="track-footer">
      <button class="footer-btn" @click="reset">
        <i class="fas fa-bolt"></i>
        Reset
      </button>
      <span class="footer-text">Copy settings by dragging them.</span>
      <button class="footer-btn auto-color" @click="autoColor">Auto Color</button>
    </footer>

    <TrackInstrumentDialog
      :show="showInstrumentDialog"
      :current-program="currentTrack?.instrumentProgram ?? 0"
      :popup-style="popupStyle"
      :arrow-style="arrowStyle"
      :arrow-placement="arrowPlacement"
      @select="handleInstrumentSelect"
      @close="closeDialogs"
    />

    <TrackRoleDialog
      :show="showRoleDialog"
      :current-role="currentTrack?.role"
      :popup-style="popupStyle"
      :arrow-style="arrowStyle"
      :arrow-placement="arrowPlacement"
      @select="handleRoleSelect"
      @close="closeDialogs"
    />

    <ColorPickerDialog
      :show="showColorPicker"
      :current-color="currentTrack?.color ?? ''"
      :popup-style="popupStyle"
      :arrow-style="arrowStyle"
      :arrow-placement="arrowPlacement"
      @select="handleColorSelect"
      @close="closeDialogs"
    />
  </section>
</template>

<style scoped>
.track-settings-wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #383838;
  color: #eeeeee;
}

.track-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64px;
  padding: 0;
  background: #2f2f2f;
  border-bottom: 1px solid #262626;
}

.header-left {
  position: absolute;
  left: 0.5rem;
  display: flex;
  gap: 0.5rem;
}

.header-btn {
  padding: 0.45rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: linear-gradient(#444, #303030);
  color: #f0f0f0;
  font-size: 1rem;
  cursor: pointer;
}

.header-btn:hover {
  background: linear-gradient(#505050, #383838);
}

.track-title {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 500;
  color: #f4f4f4;
}

.tracks-container {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 340px));
  align-content: start;
  justify-content: center;
  gap: 18px 22px;
  padding: 20px 24px 80px;
  overflow-y: auto;
}

.track-card {
  --track-color: #729fcf;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 340px;
  min-height: 136px;
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
  grid-template-columns: 54px 1fr 42px;
  align-items: center;
  gap: 8px;
  min-height: 68px;
  padding: 10px 12px 8px;
}

.track-icon,
.play-btn {
  border: 0;
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.track-icon {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset;
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
  font-size: 1.35rem;
  font-weight: 400;
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}

.track-meta {
  margin-top: 2px;
  font-size: 0.86rem;
  color: rgba(255, 255, 255, 0.88);
}

.play-btn {
  width: 34px;
  height: 44px;
  background: transparent;
  font-size: 1.35rem;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
}

.play-btn:hover,
.play-btn.active {
  transform: scale(1.08);
}

.track-controls {
  display: grid;
  grid-template-columns: 1.35fr 0.7fr 0.8fr;
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
  transition: background 0.15s, transform 0.15s;
  border-radius: 0;
}

.control-btn:last-child {
  border-right: 0;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.control-btn i {
  font-size: 1.7rem;
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

.track-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: 108px 1fr auto;
  align-items: stretch;
  min-height: 50px;
  background: #4a4a4a;
  border-top: 1px solid #5d5d5d;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.22);
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 0;
  border-right: 1px solid #363636;
  background: rgba(255, 255, 255, 0.03);
  color: #f1f1f1;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 0;
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.footer-btn i {
  color: #ffe56a;
  font-size: 1.55rem;
}

.footer-btn.auto-color {
  width: 108px;
  margin: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 5px;
  background: #686868;
}

.footer-text {
  display: flex;
  align-items: center;
  padding-left: 20px;
  font-size: 0.85rem;
  color: #ededed;
}

@media (max-width: 760px) {
  .track-header {
    justify-content: flex-end;
  }

  .track-title {
    font-size: 1.1rem;
  }

  .tracks-container {
    grid-template-columns: minmax(300px, 1fr);
    padding: 14px 14px 72px;
  }

  .track-card {
    width: 100%;
  }
}
</style>
