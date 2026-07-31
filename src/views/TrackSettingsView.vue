<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/playerStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import TrackConfigPanel from '../components/player/track-config/TrackConfigPanel.vue'
import BaseToolbar from '../components/ui/BaseToolbar.vue'
import BaseButton from '../components/ui/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const library = useLibraryStore()
const player = usePlayerStore()
const settings = useSettingsStore()

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

function reset() {
  player.stopTrackPreview()
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

useShortcuts({
  menuBack: back,
})
</script>

<template>
  <section class="track-settings-wrap">
    <BaseToolbar variant="header" class="track-header">
      <template #left>
        <BaseButton variant="secondary" @click="back">{{ t('common.back') }}</BaseButton>
        <BaseButton variant="secondary">{{ t('play.help') }}</BaseButton>
      </template>
      <template #center>
        <h1 class="track-title">{{ t('trackSettings.title') }}</h1>
      </template>
    </BaseToolbar>

    <main class="tracks-container">
      <div class="track-panel-shell">
        <TrackConfigPanel variant="standalone" :allow-role-edit="true" />
      </div>
    </main>

    <BaseToolbar variant="footer" class="track-footer">
      <template #left>
        <BaseButton variant="secondary" @click="reset">
          <i class="fas fa-bolt"></i>
          {{ t('trackSettings.reset') }}
        </BaseButton>
      </template>
      <template #center>
        <span class="footer-text">{{ t('trackSettings.copySettingsByDragging') }}</span>
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
</style>

