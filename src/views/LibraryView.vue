<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MidiImportButton from '../components/library/MidiImportButton.vue'
import FolderToggleBar from '../components/library/FolderToggleBar.vue'
import SongList from '../components/library/SongList.vue'
import SongSortBar from '../components/library/SongSortBar.vue'
import { base64ToBuffer, loadSongMidiData, loadSongMusicXmlData } from '../modules/library/songLibrary'
import { createCompressedMusicXml } from '../modules/musicxml/musicXmlCompression'
import { applyMusicXmlExportMetadata } from '../modules/musicxml/musicXmlExportMetadata'
import { generateSheetMusic } from '../modules/sheet/sheetMusicClient'
import { SheetMusicError, toSheetMusicError } from '../modules/sheet/sheetTypes'
import { useLibraryStore } from '../stores/libraryStore'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import type { SongMetadata } from '../types/song'
import BaseToolbar from '../components/ui/BaseToolbar.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'

const router = useRouter()
const { t } = useI18n()
const library = useLibraryStore()
const settings = useSettingsStore()
const toastStore = useToastStore()
const { confirm } = useConfirmDialog()
const selectedSong = computed(() => library.selectedSong)
const visibleSongCount = computed(() => library.sortedSongs.length)
const musicXmlDownloadingSongId = ref<string | null>(null)
const downloadMenuOpen = ref(false)
const missingDifficultyPromptShown = ref(false)
const autoEvaluatingMissingDifficulty = ref(false)



import { useShortcuts } from '../composables/useShortcuts'

useShortcuts({
  menuSelectNextItem: () => {
    const index = library.sortedSongs.findIndex(s => s.id === selectedSong.value?.id)
    if (index < library.sortedSongs.length - 1) {
      handleSelectSong(library.sortedSongs[index + 1])
    } else if (index === -1 && library.sortedSongs.length > 0) {
      handleSelectSong(library.sortedSongs[0])
    }
  },
  menuSelectPreviousItem: () => {
    const index = library.sortedSongs.findIndex(s => s.id === selectedSong.value?.id)
    if (index > 0) {
      handleSelectSong(library.sortedSongs[index - 1])
    } else if (index === -1 && library.sortedSongs.length > 0) {
      handleSelectSong(library.sortedSongs[0])
    }
  },
  menuNextPage: () => {
    const index = library.sortedSongs.findIndex(s => s.id === selectedSong.value?.id)
    const newIndex = Math.min(Math.max(index, 0) + 10, library.sortedSongs.length - 1)
    if (newIndex >= 0) handleSelectSong(library.sortedSongs[newIndex])
  },
  menuPreviousPage: () => {
    const index = library.sortedSongs.findIndex(s => s.id === selectedSong.value?.id)
    const newIndex = Math.max(Math.max(index, 0) - 10, 0)
    if (library.sortedSongs.length > 0) handleSelectSong(library.sortedSongs[newIndex])
  },
  menuContinue: () => {
    if (selectedSong.value) continuePlay()
  },
  menuBack: () => {
    router.push('/')
  },
})

function startPreview(song: SongMetadata | null) {
  if (!song) return
  library.startPreview(song, settings.midiOutputId, settings.defaultSpeed, settings.leadInDuration, settings.zoomPercent, settings.octaveShift)
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

function editInFreePlay() {
  const song = selectedSong.value
  if (!song) return
  library.stopPreview()
  router.push({ name: 'free-play', query: { librarySongId: song.id, openEditor: '1' } })
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

function formatDuration(durationUs: number) {
  if (!Number.isFinite(durationUs) || durationUs <= 0) return '0:00'
  const totalSeconds = Math.round(durationUs / 1_000_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

async function deleteSong() {
  const song = selectedSong.value
  if (!song) return
  if (settings.advancedConfirmBeforeDestructiveAction) {
    const confirmed = await confirm({
      title: t('library.deleteConfirmTitle'),
      message: t('library.deleteConfirmMessage', {
        title: song.title,
        duration: formatDuration(song.duration),
        playCount: song.playCount ?? 0,
      }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      tone: 'danger',
    })
    if (!confirmed) return
  }

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
  const confirmed = await confirm({
    message: t('library.autoDifficultyMissingConfirm', { n: missingSongs.length }),
    confirmLabel: t('common.continue'),
    cancelLabel: t('common.cancel'),
    tone: 'primary',
  })
  if (!confirmed) return

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
    <BaseToolbar variant="header" class="library-header">
      <template #left>
        <BaseButton variant="secondary" class="header-tab" @click="router.push('/')">{{ t('common.back') }}</BaseButton>
      </template>

      <template #center>
        <div class="library-playback">
          <BaseButton variant="icon" :disabled="!selectedSong" :aria-label="t('library.togglePreview')"
            :title="t('library.togglePreview')" :aria-pressed="settings.libraryAutoPreviewEnabled"
            @click="togglePreview">
            <i v-if="library.previewSongId === selectedSong?.id && library.previewRunning" class="fa-solid fa-pause"
              aria-hidden="true" />
            <i v-else class="fa-solid fa-play" aria-hidden="true" />
          </BaseButton>

          <div class="preview-center">
            <div class="preview-song">{{ selectedSong?.title ?? t('common.noSongSelected') }}</div>
            <div class="preview-track" @click="seekPreviewFromPointer">
              <div class="preview-fill" :style="{ width: `${Math.round(library.previewProgress * 100)}%` }" />
            </div>
          </div>

          <div class="download-menu" @click.stop>
            <BaseButton variant="icon" :disabled="!selectedSong || !!musicXmlDownloadingSongId"
              :aria-label="t('library.downloadSong')" :aria-expanded="downloadMenuOpen" aria-haspopup="menu"
              @click="toggleDownloadMenu">
              <i v-if="musicXmlDownloadingSongId" class="fa-solid fa-spinner fa-spin" aria-hidden="true" />
              <i v-else class="fa-solid fa-download" aria-hidden="true" />
            </BaseButton>

            <div v-if="downloadMenuOpen" class="download-options" role="menu">
              <button type="button" role="menuitem" @click="downloadSong">
                <span>{{ t('library.downloadMidi') }}</span>
                <span class="download-extension">.mid</span>
              </button>
              <button type="button" role="menuitem" :disabled="!!musicXmlDownloadingSongId" @click="downloadMusicXml">
                <span>{{ t('library.downloadMusicXml') }}</span>
                <span class="download-extension">.musicxml</span>
              </button>
              <button type="button" role="menuitem" :disabled="!!musicXmlDownloadingSongId"
                @click="downloadCompressedMusicXml">
                <span>{{ t('library.downloadMxl') }}</span>
                <span class="download-extension">.mxl</span>
              </button>
            </div>
          </div>

          <BaseButton variant="icon" :disabled="!selectedSong" :aria-label="t('record.record')"
            :title="t('record.record')" @click="openRecord">
            <i class="fa-solid fa-video" aria-hidden="true" />
          </BaseButton>

          <BaseButton variant="icon" :disabled="!selectedSong" :aria-label="t('library.editInFreePlay')"
            :title="t('library.editInFreePlay')" @click="editInFreePlay">
            <i class="fa-solid fa-pen-to-square" aria-hidden="true" />
          </BaseButton>

          <BaseButton variant="icon" :disabled="!selectedSong" :aria-label="t('library.deleteSong')"
            :title="t('library.deleteSong')" @click="deleteSong">
            <i class="fa-regular fa-trash-can" aria-hidden="true" />
          </BaseButton>
        </div>
      </template>

      <template #right>
        <div class="header-actions">
          <BaseButton variant="primary" class="continue-button" :disabled="!selectedSong" @click="continuePlay">{{
            t('common.continue') }}</BaseButton>
        </div>
      </template>
    </BaseToolbar>

    <BaseToolbar class="library-tools">
      <template #left>
        <FolderToggleBar />
      </template>
      <template #center>
        <div class="source-toggles">
          <button class="source-toggle musicxml" :class="{ active: library.sourceMusicXmlVisible }"
            @click="library.sourceMidiVisible ? library.toggleSourceMusicXml() : null">MusicXML</button>
          <button class="source-toggle midi" :class="{ active: library.sourceMidiVisible }"
            @click="library.sourceMusicXmlVisible ? library.toggleSourceMidi() : null">MIDI</button>
        </div>
      </template>
      <template #right>
        <div class="search-field">
          <BaseInput :model-value="library.searchQuery" :placeholder="t('common.search')"
            @update:model-value="library.setSearch($event as string)" />
          <BaseButton v-if="library.searchQuery" variant="icon" class="search-clear-button"
            :aria-label="t('common.clear')" @click="library.setSearch('')">
            <i class="fa-solid fa-xmark" aria-hidden="true" />
          </BaseButton>
        </div>
      </template>
    </BaseToolbar>

    <section class="library-main">
      <SongList :songs="library.sortedSongs" :selected-id="selectedSong?.id" @select="handleSelectSong"
        @play="continuePlay" />
    </section>

    <BaseToolbar variant="footer" class="library-footer">
      <template #left>
        <div class="footer-action">
          <MidiImportButton />
        </div>
      </template>
      <template #center>
        <div class="footer-sort">
          <SongSortBar />
        </div>
      </template>
      <template #right>
        <div class="footer-count muted">{{ t('common.songs', { count: visibleSongCount }) }}</div>
      </template>
    </BaseToolbar>
  </main>
</template>

<style scoped>
.library-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  padding: 0;
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.library-page :deep(.muted) {
  color: var(--color-text-muted);
}

.library-playback {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 25rem) 2.2rem 2.2rem 2.2rem 2.2rem;
  align-items: center;
  gap: 0.48rem;
  justify-self: center;
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
  border: 1px solid var(--color-border-default);
  border-radius: 0.48rem;
  background: var(--color-bg-input);
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
  color: var(--color-text-primary);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.download-options button:hover:not(:disabled) {
  background: var(--color-bg-subtle);
}

.download-options button:disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.download-extension {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.preview-center {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.preview-song {
  overflow: hidden;
  color: var(--color-text-primary);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.preview-track {
  position: relative;
  height: 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  overflow: visible;
  cursor: pointer;
}

.preview-fill {
  position: relative;
  height: 100%;
  min-width: 0.8rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
}

.preview-fill::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  width: 0.78rem;
  height: 0.78rem;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transform: translate(50%, -50%);
}

.library-header :deep(.base-btn) {
  height: 36px;
}

.header-tab,
.continue-button {
  height: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.library-tools {
  display: flex !important;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
}

.library-tools :deep(.base-toolbar-left) {
  flex: 1 1 auto;
  min-width: 0;
}

.library-tools :deep(.base-toolbar-center) {
  display: flex;
  justify-content: center;
}

.library-tools :deep(.base-toolbar-right) {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.source-toggles {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 3px 4px;
  background: var(--color-bg-input, rgba(0, 0, 0, 0.35));
  border: 1px solid var(--color-border-input, rgba(255, 255, 255, 0.16));
  border-radius: 8px;
  box-sizing: border-box;
  gap: 4px;
}

.source-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  padding: 0 0.75rem;
  border-radius: 5px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.source-toggle:hover:not(.active) {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.source-toggle.active.musicxml {
  background: #2196f3;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.source-toggle.active.midi {
  background: #f44336;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.library-tools :deep(.base-toolbar-right) {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.search-field :deep(.base-input) {
  width: 100%;
}

.search-field :deep(.base-input-field) {
  width: 100% !important;
  height: 38px !important;
  padding: 0 2rem 0 0.75rem !important;
  font-size: 0.9rem !important;
  border-radius: 8px !important;
  background: var(--color-bg-input, rgba(0, 0, 0, 0.35)) !important;
  color: var(--color-text-primary) !important;
  border: 1px solid var(--color-border-input, rgba(255, 255, 255, 0.16)) !important;
  transition: all 0.2s ease !important;
}

.search-field :deep(.base-input-field:focus) {
  background: var(--color-bg-input-focus) !important;
  border-color: var(--color-accent-blue) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-blue) 30%, transparent) !important;
}

.search-clear-button {
  position: absolute;
  right: 0.3rem;
  z-index: 2;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 1.2rem !important;
  height: 1.2rem !important;
  min-width: unset !important;
  min-height: unset !important;
  padding: 0 !important;
  border-radius: 50% !important;
  background: var(--color-text-muted) !important;
  color: var(--color-bg-elevated) !important;
  font-size: 0.6rem !important;
  opacity: 0.7;
  transition: opacity 0.15s ease !important;
}

.search-clear-button:hover {
  opacity: 1;
}

.library-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--color-bg-secondary);
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
  border: 1px solid var(--color-border-default);
  border-radius: 0;
  background: var(--color-bg-header);
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

  .detail-header,
  .preference-row {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
