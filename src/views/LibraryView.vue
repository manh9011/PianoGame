<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MidiImportButton from '../components/library/MidiImportButton.vue'
import FolderSelector from '../components/library/FolderSelector.vue'
import SongList from '../components/library/SongList.vue'
import SongSortBar from '../components/library/SongSortBar.vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { SongMetadata } from '../types/song'

const router = useRouter()
const { t } = useI18n()
const library = useLibraryStore()
const settings = useSettingsStore()
const selectedSong = computed(() => library.selectedSong)
const visibleSongCount = computed(() => library.sortedSongs.length)

function startPreview(song: SongMetadata | null) {
  if (!song) return
  library.startPreview(song, settings.midiOutputId, settings.defaultSpeed, settings.showDuration, settings.octaveShift)
}

function handleSelectSong(song: SongMetadata) {
  library.selectSong(song.id)
  if (settings.libraryAutoPreviewEnabled) startPreview(song)
}

function continuePlay() {
  const song = selectedSong.value
  if (!song) return
  if (!song.hash) {
    console.warn('Bài hát chưa có hash, cần import lại:', song.title)
    return
  }
  library.stopPreview()
  router.push(`/mode-select/${song.hash}`)
}

function togglePreview() {
  const enabled = !settings.libraryAutoPreviewEnabled
  settings.setLibraryAutoPreviewEnabled(enabled)
  if (enabled) startPreview(selectedSong.value)
  else library.stopPreview()
}

function deleteSong() {
  const song = selectedSong.value
  if (!song) return
  if (!confirm(t('library.deleteConfirm', { title: song.title }))) return
  library.deleteSong(song.id)
}

function seekPreviewFromPointer(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  library.seekPreviewToProgress((event.clientX - rect.left) / rect.width)
}

onMounted(() => {
  if (settings.libraryAutoPreviewEnabled) startPreview(selectedSong.value)
})

onBeforeUnmount(() => library.stopPreview())
</script>

<template>
  <main class="library-page">
    <header class="library-header">
      <button class="secondary header-tab" @click="router.push('/')">{{ t('common.back') }}</button>

      <div class="library-playback">
        <button class="icon-button" :disabled="!selectedSong" :aria-label="t('library.togglePreview')" :aria-pressed="settings.libraryAutoPreviewEnabled" @click="togglePreview">
          <i v-if="library.previewSongId === selectedSong?.id && library.previewRunning" class="fa-solid fa-pause" aria-hidden="true" />
          <i v-else class="fa-solid fa-play" aria-hidden="true" />
        </button>

        <div class="preview-center">
          <div class="preview-song">{{ selectedSong?.title ?? t('common.noSongSelected') }}</div>
          <div class="preview-track" @click="seekPreviewFromPointer">
            <div class="preview-fill" :style="{ width: `${Math.round(library.previewProgress * 100)}%` }" />
          </div>
        </div>

        <button class="icon-button" :disabled="!selectedSong" :aria-label="t('library.deleteSong')" @click="deleteSong">
          <i class="fa-regular fa-trash-can" aria-hidden="true" />
        </button>
      </div>

      <div class="header-actions">
        <button class="action-button continue-button" :disabled="!selectedSong" @click="continuePlay">{{ t('common.continue') }}</button>
      </div>
    </header>

    <section class="library-tools">
      <FolderSelector />
      <div class="search-field">
        <input
          :value="library.searchQuery"
          :placeholder="t('common.search')"
          @input="library.setSearch(($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="library.searchQuery"
          type="button"
          class="search-clear-button"
          :aria-label="t('common.clear')"
          @click="library.setSearch('')"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
    </section>

    <section class="library-main">
      <SongList :songs="library.sortedSongs" :selected-id="selectedSong?.id" @select="handleSelectSong" @play="continuePlay" />
    </section>

    <footer class="library-footer">
      <div class="footer-action">
        <MidiImportButton />
      </div>
      <div class="footer-sort">
        <SongSortBar />
      </div>
      <div class="footer-count muted">{{ t('common.songs', { count: visibleSongCount }) }}</div>
    </footer>
  </main>
</template>

<style scoped>
.library-page {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 0.22rem;
  height: 100vh;
  padding: 0;
  overflow: hidden;
  background: #373737;
}

.library-page :deep(.muted) {
  color: rgba(255, 255, 255, 0.56);
}

.library-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  min-height: 3.05rem;
  padding: 0.1rem 0.38rem;
  background: #353535;
}

.header-tab,
.action-button,
.icon-button {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.32rem;
  background: #414141;
  color: #f1f1f1;
}

.header-tab,
.action-button {
  min-height: 1.95rem;
  padding: 0.28rem 0.78rem;
  white-space: nowrap;
}

.continue-button {
  background: #484848;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.22rem;
}

.library-playback {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 25rem) 2.2rem;
  align-items: center;
  gap: 0.48rem;
  justify-self: center;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
}

.icon-button i {
  font-size: 0.92rem;
}

.preview-center {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.preview-song {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.96);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
  font-weight: 500;
}

.preview-track {
  position: relative;
  height: 0.72rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  overflow: visible;
  cursor: pointer;
}

.preview-fill {
  position: relative;
  height: 100%;
  min-width: 0.8rem;
  border-radius: 999px;
  background: rgba(150, 150, 150, 0.92);
}

.preview-fill::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  width: 0.92rem;
  height: 0.92rem;
  border: 1px solid rgba(58, 58, 58, 0.42);
  border-radius: 50%;
  background: #f3f3f3;
  transform: translate(50%, -50%);
}

.library-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 12.45rem;
  align-items: center;
  gap: 0.32rem;
  padding: 5px;
  border: 0;
  background: #4c4c4c;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.library-tools input,
.detail-modal select {
  width: 100%;
  min-height: 2.42rem;
  padding: 0.32rem 0.82rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.7rem;
  background: #3f3f3f;
  color: rgba(255, 255, 255, 0.88);
}

.search-field input {
  padding-right: 2.35rem;
}

.library-tools input::placeholder {
  color: rgba(255, 255, 255, 0.42);
}

.search-clear-button {
  position: absolute;
  right: 0.42rem;
  display: grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.74);
  cursor: pointer;
}

.search-clear-button:hover {
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.9);
}

.library-main {
  min-height: 0;
  overflow: auto;
  background: #424242;
}

.library-footer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.55rem;
  padding: 5px;
  background: transparent;
}

.footer-sort {
  display: flex;
  justify-content: center;
}

.footer-count {
  align-self: center;
  font-size: 1rem;
  white-space: nowrap;
  text-align: right;
}

.overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.76);
  z-index: 40;
}

.detail-modal {
  display: grid;
  gap: 0.9rem;
  width: min(40rem, 100%);
  max-height: 92vh;
  padding: 0.85rem;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0;
  background: #3a3a3a;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.detail-header h2,
.detail-kicker,
.detail-path {
  margin: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.42rem 0.8rem;
}

.preference-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.8rem;
}

@media (max-width: 900px) {
  .library-playback {
    grid-template-columns: 2.2rem minmax(0, 1fr) 2.2rem;
  }

  .library-footer {
    grid-template-columns: 1fr;
  }

  .footer-count {
    text-align: left;
  }
}

@media (max-width: 760px) {
  .library-page {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .library-header,
  .library-tools {
    grid-template-columns: 1fr;
  }

  .header-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .action-button {
    width: 100%;
  }

  .detail-header,
  .preference-row {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
