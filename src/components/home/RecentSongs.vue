<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSettingsStore } from '../../stores/settingsStore'

const library = useLibraryStore()
const player = usePlayerStore()
const profile = useProfileStore()
const settings = useSettingsStore()
const router = useRouter()
const recent = computed(() => profile.activeProfile.recentSongIds.map(id => library.songs.find(s => s.id === id)).filter(Boolean))
async function play(songId: string) {
  const song = library.songs.find(s => s.id === songId)
  if (!song) return
  await player.loadSong(song, settings.defaultSpeed, settings.showDuration, settings.octaveShift)
  router.push('/play')
}
</script>

<template>
  <section class="panel">
    <h2>Bản nhạc vừa chơi</h2>
    <div v-if="recent.length" class="list">
      <div v-for="song in recent" :key="song!.id" class="song-row">
        <div>
          <strong>{{ song!.title }}</strong>
          <div class="muted">Best score: {{ song!.bestScore }} · Play count: {{ song!.playCount }}</div>
        </div>
        <button @click="play(song!.id)">Chơi lại</button>
      </div>
    </div>
    <p v-else class="muted">Chưa có bản nhạc gần đây.</p>
  </section>
</template>
