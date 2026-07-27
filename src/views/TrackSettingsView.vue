<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/playerStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import TrackConfigPanel from '../components/player/track-config/TrackConfigPanel.vue'

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
</script>

<template>
  <section class="track-settings-wrap">
    <header class="track-header">
      <div class="header-left">
        <button class="header-btn" @click="back">{{ t('common.back') }}</button>
        <button class="header-btn">{{ t('play.help') }}</button>
      </div>
      <h1 class="track-title">{{ t('trackSettings.title') }}</h1>
    </header>

    <main class="tracks-container">
      <div class="track-panel-shell">
        <TrackConfigPanel variant="standalone" :allow-role-edit="true" />
      </div>
    </main>

    <footer class="track-footer">
      <button class="footer-btn" @click="reset">
        <i class="fas fa-bolt"></i>
        {{ t('trackSettings.reset') }}
      </button>
      <span class="footer-text">{{ t('trackSettings.copySettingsByDragging') }}</span>
      <button class="footer-btn auto-color" @click="autoColor">{{ t('trackSettings.autoColor') }}</button>
    </footer>
  </section>
</template>

<style scoped>
.track-settings-wrap {
  min-height: 100dvh;
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
  inset-inline-start: 0.5rem;
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
  min-height: 0;
  overflow-y: auto;
  padding: 24px 32px 80px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.track-panel-shell {
  width: 100%;
  max-width: 900px;
}

.track-footer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #2f2f2f;
}

.footer-btn {
  min-height: 2.4rem;
  padding: 0 1rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: linear-gradient(#444, #303030);
  color: #f0f0f0;
  cursor: pointer;
}

.footer-btn:hover {
  background: linear-gradient(#505050, #383838);
}

.footer-text {
  color: rgba(255, 255, 255, 0.68);
  text-align: center;
}

.auto-color {
  white-space: nowrap;
}

@media (max-width: 760px) {
  .track-footer {
    grid-template-columns: 1fr;
  }

  .footer-text {
    text-align: left;
  }
}
</style>
