<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/playerStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useProfileStore } from '../stores/profileStore'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import TrackConfigPanel from '../components/player/track-config/TrackConfigPanel.vue'
import BaseToolbar from '../components/ui/BaseToolbar.vue'
import BaseButton from '../components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const library = useLibraryStore()
const player = usePlayerStore()
const settings = useSettingsStore()
const profileStore = useProfileStore()
const confirm = useConfirmDialog()

function back() {
  player.stopTrackPreview()
  const hash = player.song?.playbackHash ?? player.song?.hash
  router.push(`/mode-select/${hash}`)
}

async function ensureSongLoaded() {
  const routeHash = route.params.hash as string | undefined
  const fallbackHash = player.song?.playbackHash ?? player.song?.hash
  const hash = routeHash ?? fallbackHash

  if (!hash) {
    router.replace('/library')
    return
  }

  if (!routeHash) {
    router.replace(`/track-settings/${hash}`)
    return
  }

  const song = library.songByHash(hash)
  if (!song) {
    console.warn('Không tìm thấy bài hát với hash:', hash)
    router.replace('/library')
    return
  }

  if (!player.song || (player.song.playbackHash ?? player.song.hash) !== hash) {
    await player.loadSong(song, settings.defaultSpeed, settings.showDuration, settings.octaveShift)
  }
}

async function reset() {
  const confirmed = await confirm.confirm({
    title: t('trackSettings.resetConfirmTitle'),
    message: t('trackSettings.resetConfirmMessage'),
    confirmLabel: t('trackSettings.resetConfirmYes'),
    cancelLabel: t('common.cancel'),
  })
  if (!confirmed) return
  player.stopTrackPreview()
  if (player.song) {
    profileStore.clearTrackSettings(player.song.id)
    await player.loadSong(player.song, settings.defaultSpeed, settings.showDuration, settings.octaveShift)
  }
}

export type DragType = 'instrument' | 'role' | 'color' | 'mode'

const isDragging = ref(false)
const dragType = ref<DragType | null>(null)
const dragValue = ref<any>(null)
const draggedTrackId = ref<number | null>(null)

function handleDragStart(type: DragType, value: any, trackId: number) {
  isDragging.value = true
  dragType.value = type
  dragValue.value = value
  draggedTrackId.value = trackId
}

function handleDragEnd() {
  isDragging.value = false
  dragType.value = null
  dragValue.value = null
  draggedTrackId.value = null
}

function handleDropAll(event: DragEvent) {
  event.preventDefault()
  if (!dragType.value || dragValue.value === null || dragValue.value === undefined) return
  const type = dragType.value
  const val = dragValue.value

  player.session?.tracks.forEach(track => {
    if (track.trackId !== draggedTrackId.value) {
      if (type === 'instrument') {
        player.setTrackInstrument(track.trackId, Number(val))
      } else if (type === 'role') {
        player.setTrackRole(track.trackId, val)
      } else if (type === 'color') {
        player.setTrackColor(track.trackId, val)
      } else if (type === 'mode') {
        player.setTrackMode(track.trackId, val)
      }
    }
  })
  handleDragEnd()
}

function handleDropReset(event: DragEvent) {
  event.preventDefault()
  if (draggedTrackId.value === null || !dragType.value) return
  const trackId = draggedTrackId.value
  const type = dragType.value
  const track = player.session?.tracks.find(t => t.trackId === trackId)

  if (track) {
    if (type === 'instrument' && track.defaultInstrumentProgram !== undefined) {
      player.setTrackInstrument(trackId, track.defaultInstrumentProgram)
    } else if (type === 'role' && track.defaultRole !== undefined) {
      player.setTrackRole(trackId, track.defaultRole)
    } else if (type === 'color' && track.defaultColor !== undefined) {
      player.setTrackColor(trackId, track.defaultColor)
    } else if (type === 'mode' && track.defaultMode !== undefined) {
      player.setTrackMode(trackId, track.defaultMode)
    }
  }
  handleDragEnd()
}

function autoColor() {
  if (!player.session) return
  const fallbackColors = ['#f57900', '#fce94f', '#ad7fa8', '#ef2929']
  let fallbackIndex = 0

  player.session.tracks.forEach(track => {
    const trackNotes = player.session!.notes.filter(note => note.trackId === track.trackId)
    const hands = trackNotes.filter(note => note.hand).map(note => note.hand)
    const leftCount = hands.filter(hand => hand === 'left').length
    const rightCount = hands.filter(hand => hand === 'right').length

    let color: string
    if (track.role === 'left' || (track.handAssignment === 'left')) {
      color = '#729fcf'
    } else if (track.role === 'right' || (track.handAssignment === 'right')) {
      color = '#4e9a06'
    } else if (track.role === 'background' || (leftCount > 0 && rightCount > 0)) {
      color = fallbackColors[fallbackIndex % fallbackColors.length]
      fallbackIndex += 1
    } else {
      color = leftCount > rightCount ? '#729fcf' : '#4e9a06'
    }

    player.setTrackColor(track.trackId, color)
  })
}

onMounted(() => {
  void ensureSongLoaded()
})

onBeforeUnmount(() => {
  player.stopTrackPreview()
})

import { useShortcuts } from '../composables/useShortcuts'

function openHelpGuide() {
  const url = 'https://synthesia.app/support/guide/SongSetup'
  window.open(url, '_blank', 'noopener,noreferrer')
}

useShortcuts({
  menuBack: back,
})
</script>

<template>
  <section class="track-settings-wrap">
    <BaseToolbar variant="header" class="track-header">
      <template #left>
        <BaseButton variant="secondary" @click="back">{{ t('common.back') }}</BaseButton>
      </template>
      <template #center>
        <h1 class="track-title">{{ t('trackSettings.title') }}</h1>
      </template>
      <template #right>
        <BaseButton variant="secondary" @click="openHelpGuide">{{ t('play.help') }}</BaseButton>
      </template>
    </BaseToolbar>

    <main class="tracks-container">
      <div class="track-panel-shell">
        <TrackConfigPanel variant="standalone" :allow-role-edit="true" 
          @drag-start="handleDragStart" 
          @drag-end="handleDragEnd" />
      </div>
    </main>

    <BaseToolbar variant="footer" class="track-footer" :class="{ 'dragging-active': isDragging }">
      <template #left>
        <BaseButton variant="secondary" @click="reset"
          @dragover.prevent
          @dragenter.prevent
          @drop="handleDropReset"
          :class="{ 'drop-zone': isDragging }">
          <i class="fas fa-bolt"></i>
          {{ t('trackSettings.reset') }}
        </BaseButton>
      </template>
      <template #center>
        <BaseButton v-if="isDragging" variant="secondary" class="drop-zone drop-zone-center"
          @dragover.prevent
          @dragenter.prevent
          @drop="handleDropAll">
          {{ t('trackSettings.applyToAll') }}
        </BaseButton>
        <span v-else class="footer-text">{{ t('trackSettings.copySettingsByDragging') }}</span>
      </template>
      <template #right>
        <BaseButton variant="secondary" class="auto-color" @click="autoColor">{{ t('trackSettings.autoColor') }}</BaseButton>
      </template>
    </BaseToolbar>
  </section>
</template>

<style scoped>
.track-settings-wrap {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.track-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tracks-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 32px 80px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.track-panel-shell {
  width: 100%;
  max-width: 1360px;
}

.footer-text {
  color: var(--color-text-muted);
  text-align: center;
}

.auto-color {
  white-space: nowrap;
}

@media (max-width: 760px) {
  .footer-text {
    text-align: left;
  }
}

.drop-zone {
  box-shadow: 0 0 12px rgba(252, 233, 79, 0.6) !important;
  border: 1px solid #fce94f !important;
  transition: all 0.2s ease;
}

.drop-zone:hover, .drop-zone:dragover {
  background: rgba(252, 233, 79, 0.2) !important;
  transform: scale(1.05);
}

.drop-zone-center {
  padding: 0.4rem 1.5rem;
  font-weight: 700;
}
</style>

