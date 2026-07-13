<script setup lang="ts">
import { usePlayerStore } from '../../stores/playerStore'
import { TRACK_MODES, type TrackMode } from '../../modules/game/trackProperties'

const player = usePlayerStore()
const labels: Record<TrackMode, string> = {
  playedAutomatically: 'Played Automatically',
  youPlay: 'You Play',
  playedButHidden: 'Played But Hidden',
  notPlayed: 'Not Played',
}
</script>

<template>
  <section v-if="player.session" class="track-modes">
    <strong>Track modes</strong>
    <div class="track-grid">
      <div v-for="track in player.session.tracks" :key="track.trackId" class="track-row">
        <span class="swatch" :style="{ backgroundColor: track.color }"></span>
        <strong>Track {{ track.trackId + 1 }}</strong>
        <select :value="track.mode" @change="player.setTrackMode(track.trackId, ($event.target as HTMLSelectElement).value as TrackMode)">
          <option v-for="mode in TRACK_MODES" :key="mode" :value="mode">{{ labels[mode] }}</option>
        </select>
      </div>
    </div>
  </section>
</template>

<style scoped>
.track-modes { position: absolute; left: 0.5rem; top: 4.5rem; z-index: 10; width: min(360px, calc(100vw - 1rem)); max-height: min(36vh, 240px); overflow: auto; display: grid; gap: 0.45rem; padding: 0.55rem; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; background: rgba(15, 18, 23, 0.72); box-shadow: 0 8px 22px rgba(0,0,0,0.22); backdrop-filter: blur(8px); }
.track-grid { display: grid; gap: 0.4rem; }
.track-row { display: grid; grid-template-columns: auto 1fr minmax(8rem, auto); gap: 0.45rem; align-items: center; font-size: 0.82rem; }
.track-row select { padding: 0.3rem 0.4rem; font-size: 0.82rem; }
.swatch { width: 14px; height: 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.45); }
</style>
