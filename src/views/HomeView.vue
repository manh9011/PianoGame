<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import LanguageDropup from '../components/home/LanguageDropup.vue'
import ProfileManager from '../components/home/ProfileManager.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import AboutDialog from '../components/home/AboutDialog.vue'
import { formatRelativeTime } from '../i18n/formatters'
import { name as appName, version as appVersion, copyright as appCopyright } from '../../package.json'
const router = useRouter()
const { t } = useI18n()
const app = useAppStore()
const library = useLibraryStore()
const profile = useProfileStore()
const settings = useSettingsStore()

const showProfileManager = ref(false)
const showAboutDialog = ref(false)

const recentSongs = computed(() =>
  profile.activeProfile.recentSongIds
    .map(id => library.songs.find(s => s.id === id))
    .filter(Boolean)
    .slice(0, 5)
)

function formatTimeAgo(timestamp: number): string {
  return timestamp ? formatRelativeTime(timestamp, settings.locale) : t('common.never')
}

function playSong(songId: string) {
  const song = library.songs.find(s => s.id === songId)
  const hash = song?.playbackHash ?? song?.hash
  if (!hash) return
  router.push(`/mode-select/${hash}`)
}

function toggleProfileManager() {
  showProfileManager.value = !showProfileManager.value
}

function closeProfileManager() {
  showProfileManager.value = false
}

</script>

<template>
  <div class="home-container">
    <!-- Header -->
    <header class="home-header">
      <div class="header-left">
        <div class="app-icon">🎹</div>
        <h1 class="app-name">{{ appName }}</h1>
      </div>
      <div class="header-right">
        <BaseButton variant="secondary" class="username-button" :aria-label="t('home.profileMenu')"
          @click="toggleProfileManager">
          {{ profile.activeProfile.name }} ▾
        </BaseButton>

        <!-- Profile Manager Dropdown -->
        <Teleport to="body">
          <div v-if="showProfileManager">
            <div class="profile-dropdown-overlay" @click="closeProfileManager"></div>
            <div class="profile-dropdown" @click.stop>
              <ProfileManager />
            </div>
          </div>
        </Teleport>
      </div>
      <AboutDialog :show="showAboutDialog" @close="showAboutDialog = false" />
    </header>

    <!-- Main Content -->
    <main class="home-main">
      <!-- Left Panel - Menu Buttons -->
      <div class="left-panel">
        <BaseButton variant="primary" class="menu-button" @click="router.push('/library')">
          {{ t('home.playSong') }}
        </BaseButton>
        <BaseButton variant="primary" class="menu-button" @click="router.push('/free-play')">
          {{ t('home.freePlay') }}
        </BaseButton>
        <BaseButton variant="primary" class="menu-button transcription-btn" @click="router.push('/transcription')">
          {{ t('home.transcription') }}<sup class="beta-badge">BETA</sup>
        </BaseButton>
        <BaseButton variant="primary" class="menu-button transcription-btn" @click="router.push('/chord-visualizer')">
          {{ t('home.chordVisualizer') }}<sup class="beta-badge">BETA</sup>
        </BaseButton>
        <BaseButton variant="primary" class="menu-button transcription-btn" @click="router.push('/score-library')">
          {{ t('home.scoreLibrary') }}<sup class="beta-badge">BETA</sup>
        </BaseButton>
        <BaseButton variant="secondary" class="menu-button" @click="router.push('/settings')">
          {{ t('common.settings') }}
        </BaseButton>
        <BaseButton variant="secondary" class="menu-button" @click="showAboutDialog = true">
          {{ t('home.about') }}
        </BaseButton>
        <BaseButton v-if="app.isTauriApp" variant="secondary" class="menu-button" @click="app.exitApp">
          {{ t('home.exit') }}
        </BaseButton>
      </div>

      <!-- Right Panel - Recently Played -->
      <div class="right-panel">
        <h2 class="panel-title">{{ t('home.recentlyPlayed') }}</h2>
        <div v-if="recentSongs.length" class="recent-list">
          <button v-for="song in recentSongs" :key="song!.id" class="recent-item" @click="playSong(song!.id)">
            <span class="song-name">{{ song!.title }}</span>
            <div class="recent-right">
              <span class="song-time">{{ formatTimeAgo(song!.lastPlayed) }}</span>
              <span class="arrow">›</span>
            </div>
          </button>
        </div>
        <p v-else class="empty-message">{{ t('home.noRecentSongs') }}</p>
      </div>
    </main>

    <!-- Footer -->
    <footer class="home-footer">
      <div class="footer-left">
        <LanguageDropup />
      </div>
      <div class="footer-center">
        <div class="footer-info">{{ t('common.input') }}: {{ settings.midiInputId || t('common.noMidiInput') }}</div>
        <div class="footer-info">{{ t('common.output') }}: {{ settings.midiOutputId || t('common.builtInSynthesizer') }}
        </div>
      </div>
      <div class="footer-right">
        <div class="version">{{ appVersion }}</div>
        <div class="copyright">{{ appCopyright }}</div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

/* Header */
.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border-subtle);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-icon {
  font-size: 2rem;
}

.app-name {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 400;
  color: var(--color-text-primary);
}

.header-right {
  position: relative;
  font-size: 1.1rem;
  color: var(--color-text-secondary);
}


.profile-dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--color-bg-overlay);
}

.profile-dropdown {
  position: fixed;
  top: 60px;
  right: 20px;
  z-index: 1001;
  min-width: 400px;
  padding: 15px;
  border-radius: 6px;
  background: var(--color-bg-header);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-default);
}

.profile-dropdown :deep(.panel) {
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.profile-dropdown :deep(h2) {
  margin: 0 0 12px 0;
  color: var(--color-text-primary);
  font-size: 1.1rem;
}

/* Main Content */
.home-main {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 20px;
  flex: 1;
  padding: 20px;
  overflow: hidden;
}

/* Left Panel */
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px;
}

.menu-button {
  width: 100%;
  padding: 18px 24px;
  font-size: 1.1rem;
}

.transcription-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.beta-badge {
  font-size: 0.65rem;
  background: var(--color-primary);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  font-weight: bold;
}

/* Right Panel */
.right-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
  min-height: 0;
}

.panel-title {
  margin: 0 0 15px 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
}

.recent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.2s ease;
  text-align: left;
  border-bottom: 1px solid var(--color-border-subtle);
  border-radius: 0;
}

.recent-item:hover {
  background: var(--color-bg-subtle);
}

.song-name {
  font-size: 1rem;
  font-weight: 400;
}

.recent-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.song-time {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.arrow {
  font-size: 1.5rem;
  color: var(--color-text-muted);
}

.empty-message {
  margin: 0;
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
}

/* Footer */
.home-footer {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  padding: 10px 20px;
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border-subtle);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.footer-left,
.footer-center,
.footer-right {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.footer-center {
  text-align: center;
  align-items: center;
}

.footer-right {
  text-align: right;
  align-items: flex-end;
}

.language {
  font-weight: 500;
}

.footer-info {
  font-size: 0.8rem;
}

.version {
  font-weight: 500;
}

.copyright {
  font-size: 0.75rem;
}

/* Responsive */
@media (max-width: 1024px) {
  .home-main {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .left-panel {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .menu-button {
    flex: 1;
    min-width: 150px;
  }
}
</style>
