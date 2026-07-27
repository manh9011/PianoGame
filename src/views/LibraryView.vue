<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MidiImportButton from '../components/library/MidiImportButton.vue'
import FolderSelector from '../components/library/FolderSelector.vue'
import SongList from '../components/library/SongList.vue'
import SongSortBar from '../components/library/SongSortBar.vue'
import { base64ToBuffer, loadSongMidiData, loadSongMusicXmlData } from '../modules/library/songLibrary'
import { createCompressedMusicXml } from '../modules/musicxml/musicXmlCompression'
import { applyMusicXmlExportMetadata } from '../modules/musicxml/musicXmlExportMetadata'
import { generateSheetMusic } from '../modules/sheet/sheetMusicClient'
import { SheetMusicError, toSheetMusicError } from '../modules/sheet/sheetTypes'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import type { SongMetadata } from '../types/song'

const router = useRouter()
const { t } = useI18n()
const library = useLibraryStore()
const settings = useSettingsStore()
const toastStore = useToastStore()
const selectedSong = computed(() => library.selectedSong)
const visibleSongCount = computed(() => library.sortedSongs.length)
const musicXmlDownloadingSongId = ref<string | null>(null)
const downloadMenuOpen = ref(false)
const missingDifficultyPromptShown = ref(false)
const autoEvaluatingMissingDifficulty = ref(false)

watch(
  () => settings.songsSortByRecentlyImported,
  recentlyImportedFirst => library.setDefaultSortFromSettings(recentlyImportedFirst),
  { immediate: true },
)

function startPreview(song: SongMetadata | null) {
  if (!song) return
  library.startPreview(song, settings.midiOutputId, settings.defaultSpeed, settings.showDuration, settings.octaveShift)
}

function handleSelectSong(song: SongMetadata) {
  library.selectSong(song.id)
  if (settings.libraryAutoPreviewEnabled) startPreview(song)
}

function resolveSelectedSongHash() {
  const song = selectedSong.value
  if (!song) return null
  const hash = song.playbackHash ?? song.hash
  if (!hash) {
    console.warn('Bài hát chưa có hash, cần import lại:', song.title)
    return null
  }
  return hash
}

function continuePlay() {
  const hash = resolveSelectedSongHash()
  if (!hash) return
  library.stopPreview()
  router.push(`/mode-select/${hash}`)
}

function openRecord() {
  const hash = resolveSelectedSongHash()
  if (!hash) return
  library.stopPreview()
  router.push(`/record/${hash}`)
}

function togglePreview() {
  const enabled = !settings.libraryAutoPreviewEnabled
  settings.setLibraryAutoPreviewEnabled(enabled)
  if (enabled) startPreview(selectedSong.value)
  else library.stopPreview()
}

function exportName(song: SongMetadata) {
  return song.title || t('library.downloadFallbackName')
}

function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function toggleDownloadMenu() {
  if (!selectedSong.value) return
  downloadMenuOpen.value = !downloadMenuOpen.value
}

function closeDownloadMenu() {
  downloadMenuOpen.value = false
}

async function downloadSong() {
  closeDownloadMenu()
  const song = selectedSong.value
  if (!song) return
  const data = song.data ?? song.midiData ?? await loadSongMidiData(song.id)
  if (!data) return

  downloadBlob(new Blob([base64ToBuffer(data)], { type: 'audio/midi' }), `${exportName(song)}.mid`)
}

async function getSongMusicXml(song: SongMetadata) {
  const musicXml = song.musicXmlData ?? await loadSongMusicXmlData(song.id)
  if (musicXml) return applyMusicXmlExportMetadata(musicXml, exportName(song))

  const data = song.data ?? song.midiData ?? await loadSongMidiData(song.id)
  if (!data) throw new SheetMusicError('sheetMusic.errors.missingMidiData', 'missingMidiData')

  const cacheKey = `${song.playbackHash ?? song.hash ?? song.id}:sheet-v20:tracks=all`
  const generated = await generateSheetMusic(cacheKey, base64ToBuffer(data), progress => {
    if (progress.code) toastStore.showLoading(t(`sheetMusic.progress.${progress.code}`, progress.values ?? {}))
  })
  return applyMusicXmlExportMetadata(generated.musicXml, exportName(song))
}

async function downloadMusicXml() {
  closeDownloadMenu()
  const song = selectedSong.value
  if (!song || musicXmlDownloadingSongId.value) return
  musicXmlDownloadingSongId.value = song.id
  toastStore.showLoading(t('library.musicXmlDownloadProgress'))

  try {
    const musicXml = await getSongMusicXml(song)
    downloadBlob(
      new Blob([musicXml], { type: 'application/vnd.recordare.musicxml+xml' }),
      `${exportName(song)}.musicxml`,
    )
    toastStore.showSuccess(t('library.musicXmlDownloadSuccess'))
  } catch (error) {
    const sheetError = toSheetMusicError(error)
    const message = sheetError.code ? t(`sheetMusic.errors.${sheetError.code}`, sheetError.values) : sheetError.message
    toastStore.showError(t('library.musicXmlDownloadFailed', { message }))
  } finally {
    musicXmlDownloadingSongId.value = null
  }
}

async function downloadCompressedMusicXml() {
  closeDownloadMenu()
  const song = selectedSong.value
  if (!song || musicXmlDownloadingSongId.value) return
  musicXmlDownloadingSongId.value = song.id
  toastStore.showLoading(t('library.mxlDownloadProgress'))

  try {
    const compressedMusicXml = await createCompressedMusicXml(await getSongMusicXml(song))
    downloadBlob(
      new Blob([compressedMusicXml], { type: 'application/vnd.recordare.musicxml' }),
      `${exportName(song)}.mxl`,
    )
    toastStore.showSuccess(t('library.mxlDownloadSuccess'))
  } catch (error) {
    const sheetError = toSheetMusicError(error)
    const message = sheetError.code ? t(`sheetMusic.errors.${sheetError.code}`, sheetError.values) : sheetError.message
    toastStore.showError(t('library.mxlDownloadFailed', { message }))
  } finally {
    musicXmlDownloadingSongId.value = null
  }
}

async function deleteSong() {
  const song = selectedSong.value
  if (!song) return
  if (!confirm(t('library.deleteConfirm', { title: song.title }))) return

  try {
    await library.deleteSong(song.id)
    toastStore.showSuccess(t('library.deleteSuccess', { title: song.title }))
  } catch (error) {
    console.error('[Library View] Lỗi khi xóa bài:', error)
    toastStore.showError(t('library.deleteFailed', { title: song.title }))
  }
}

function seekPreviewFromPointer(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  library.seekPreviewToProgress((event.clientX - rect.left) / rect.width)
}

async function promptAutoEvaluateMissingDifficulty() {
  if (missingDifficultyPromptShown.value || autoEvaluatingMissingDifficulty.value) return
  const missingSongs = library.songs.filter(song => song.difficulty == null)
  if (!missingSongs.length) return
  missingDifficultyPromptShown.value = true
  if (!confirm(t('library.autoDifficultyMissingConfirm', { n: missingSongs.length }))) return

  autoEvaluatingMissingDifficulty.value = true
  toastStore.showLoading(t('library.autoDifficultyBatchProgress', { current: 0, total: missingSongs.length }))
  toastStore.updateProgress(0)

  try {
    const result = await library.evaluateSongDifficulties(missingSongs.map(song => song.id), progress => {
      toastStore.showLoading(t('library.autoDifficultyBatchProgress', { current: progress.current, total: progress.total }))
      toastStore.updateProgress(progress.total ? Math.round((progress.current / progress.total) * 100) : 100)
    })

    if (result.failed.length) {
      toastStore.showError(t('library.autoDifficultyBatchPartialFailed', { completed: result.completed, failed: result.failed.length }))
    } else {
      toastStore.showSuccess(t('library.autoDifficultyBatchSuccess', { count: result.completed }))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toastStore.showError(t('library.autoDifficultyBatchFailed', { message }))
  } finally {
    autoEvaluatingMissingDifficulty.value = false
  }
}

onMounted(() => {
  if (settings.libraryAutoPreviewEnabled) startPreview(selectedSong.value)
  window.addEventListener('click', closeDownloadMenu)
  void promptAutoEvaluateMissingDifficulty()
})

onBeforeUnmount(() => {
  library.stopPreview()
  window.removeEventListener('click', closeDownloadMenu)
})
</script>

<template>
  <main class="library-page">
    <header class="library-header">
      <button class="secondary header-tab" @click="router.push('/')">{{ t('common.back') }}</button>

      <div class="library-playback">
        <button class="icon-button" :disabled="!selectedSong" :aria-label="t('library.togglePreview')" :title="t('library.togglePreview')" :aria-pressed="settings.libraryAutoPreviewEnabled" @click="togglePreview">
          <i v-if="library.previewSongId === selectedSong?.id && library.previewRunning" class="fa-solid fa-pause" aria-hidden="true" />
          <i v-else class="fa-solid fa-play" aria-hidden="true" />
        </button>

        <div class="preview-center">
          <div class="preview-song">{{ selectedSong?.title ?? t('common.noSongSelected') }}</div>
          <div class="preview-track" @click="seekPreviewFromPointer">
            <div class="preview-fill" :style="{ width: `${Math.round(library.previewProgress * 100)}%` }" />
          </div>
        </div>

        <div class="download-menu" @click.stop>
          <button
            class="icon-button"
            :disabled="!selectedSong || !!musicXmlDownloadingSongId"
            :aria-label="t('library.downloadSong')"
            :aria-expanded="downloadMenuOpen"
            aria-haspopup="menu"
            @click="toggleDownloadMenu"
          >
            <i v-if="musicXmlDownloadingSongId" class="fa-solid fa-spinner fa-spin" aria-hidden="true" />
            <i v-else class="fa-solid fa-download" aria-hidden="true" />
          </button>

          <div v-if="downloadMenuOpen" class="download-options" role="menu">
            <button type="button" role="menuitem" @click="downloadSong">
              <span>{{ t('library.downloadMidi') }}</span>
              <span class="download-extension">.mid</span>
            </button>
            <button type="button" role="menuitem" :disabled="!!musicXmlDownloadingSongId" @click="downloadMusicXml">
              <span>{{ t('library.downloadMusicXml') }}</span>
              <span class="download-extension">.musicxml</span>
            </button>
            <button type="button" role="menuitem" :disabled="!!musicXmlDownloadingSongId" @click="downloadCompressedMusicXml">
              <span>{{ t('library.downloadMxl') }}</span>
              <span class="download-extension">.mxl</span>
            </button>
          </div>
        </div>
        
        <button class="icon-button" :disabled="!selectedSong" :aria-label="t('record.record')" :title="t('record.record')" @click="openRecord">
          <i class="fa-solid fa-video" aria-hidden="true" />
        </button>

        <button class="icon-button" :disabled="!selectedSong" :aria-label="t('library.deleteSong')" :title="t('library.deleteSong')" @click="deleteSong">
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
  height: 100dvh;
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
  grid-template-columns: 2.2rem minmax(0, 25rem) 2.2rem 2.2rem 2.2rem;
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

.download-menu {
  position: relative;
}

.download-options {
  position: absolute;
  top: calc(100% + 0.28rem);
  right: 0;
  display: grid;
  min-width: 14.75rem;
  padding: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.48rem;
  background: #3f3f3f;
  box-shadow: 0 0.5rem 1.2rem rgba(0, 0, 0, 0.28);
  z-index: 20;
}

.download-options button {
  display: grid;
  grid-template-columns: minmax(max-content, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 2.25rem;
  padding: 0.35rem 0.65rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.download-options button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.download-options button:disabled {
  color: rgba(255, 255, 255, 0.42);
  cursor: not-allowed;
}

.download-extension {
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.78rem;
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
  transition: grid-template-columns 0.24s ease;
}

.library-tools:has(.search-field:focus-within) {
  grid-template-columns: minmax(0, 1fr) 20.5rem;
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
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.search-field input:focus {
  border-color: rgba(255, 255, 255, 0.32);
  outline: none;
  background: #464646;
  box-shadow: 0 0.35rem 1rem rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
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
  max-height: 92dvh;
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
    grid-template-columns: 2.2rem minmax(0, 1fr) 2.2rem 2.2rem 2.2rem;
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
    min-height: 100dvh;
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
