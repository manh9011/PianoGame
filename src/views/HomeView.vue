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
import { formatRelativeTime } from '../i18n/formatters'

const router = useRouter()
const { t } = useI18n()
const app = useAppStore()
const library = useLibraryStore()
const profile = useProfileStore()
const settings = useSettingsStore()

const showProfileManager = ref(false)

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
  if (!song?.hash) return
  router.push(`/mode-select/${song.hash}`)
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
        <h1 class="app-name">{{ t('app.name') }}</h1>
      </div>
      <div class="header-right">
        <button class="username-button" :aria-label="t('home.profileMenu')" @click="toggleProfileManager">
          {{ profile.activeProfile.name }} ▾
        </button>

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
    </header>

    <!-- Main Content -->
    <main class="home-main">
      <!-- Left Panel - Menu Buttons -->
      <div class="left-panel">
        <button class="menu-button primary" @click="router.push('/library')">
          {{ t('home.playSong') }}
        </button>
        <button class="menu-button primary" @click="router.push('/library')" disabled>
          {{ t('home.freePlay') }}
        </button>
        <button class="menu-button secondary" @click="router.push('/settings')">
          {{ t('common.settings') }}
        </button>
        <button class="menu-button secondary" @click="app.exitApp">
          {{ t('home.exit') }}
        </button>
      </div>

      <!-- Right Panel - Recently Played -->
      <div class="right-panel">
        <h2 class="panel-title">{{ t('home.recentlyPlayed') }}</h2>
        <div v-if="recentSongs.length" class="recent-list">
          <button
            v-for="song in recentSongs"
            :key="song!.id"
            class="recent-item"
            @click="playSong(song!.id)"
          >
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
        <div class="footer-info">{{ t('common.output') }}: {{ settings.midiOutputId || t('common.builtInSynthesizer') }}</div>
      </div>
      <div class="footer-right">
        <div class="version">{{ t('app.version') }}</div>
        <div class="copyright">{{ t('app.copyright') }}</div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #4a4a4a;
  color: #e0e0e0;
}

/* Header */
.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #3a3a3a;
  border-bottom: 1px solid #2a2a2a;
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
  color: #ffffff;
}

.header-right {
  position: relative;
  font-size: 1.1rem;
  color: #b0b0b0;
}

.username-button {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #e0e0e0;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.username-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.profile-dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
}

.profile-dropdown {
  position: fixed;
  top: 60px;
  right: 20px;
  z-index: 1001;
  min-width: 400px;
  padding: 15px;
  border-radius: 6px;
  background: #3a3a3a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  color: #ffffff;
  font-size: 1.1rem;
}

.profile-dropdown :deep(.row) {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.profile-dropdown :deep(select),
.profile-dropdown :deep(input) {
  flex: 1;
  min-width: 150px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: #4a4a4a;
  color: #e0e0e0;
  font-size: 0.9rem;
}

.profile-dropdown :deep(button) {
  padding: 8px 16px;
  border: 0;
  border-radius: 4px;
  background: #5a9e5a;
  color: #ffffff;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.profile-dropdown :deep(button:hover) {
  background: #6ab06a;
}

.profile-dropdown :deep(button.danger) {
  background: #c55a5a;
}

.profile-dropdown :deep(button.danger:hover:not(:disabled)) {
  background: #d56a6a;
}

.profile-dropdown :deep(button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
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
  padding: 18px 24px;
  border: 0;
  border-radius: 4px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.menu-button.primary {
  background: #5a9e5a;
  color: #ffffff;
}

.menu-button.primary:hover:not(:disabled) {
  background: #6ab06a;
}

.menu-button.secondary {
  background: #6a6a6a;
  color: #d0d0d0;
}

.menu-button.secondary:hover:not(:disabled) {
  background: #7a7a7a;
}

.menu-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Right Panel */
.right-panel {
  display: flex;
  flex-direction: column;
  background: #3a3a3a;
  border-radius: 8px;
  padding: 20px;
  min-height: 0;
}

.panel-title {
  margin: 0 0 15px 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: #ffffff;
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
  color: #e0e0e0;
  cursor: pointer;
  transition: background 0.2s ease;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
}

.recent-item:hover {
  background: rgba(255, 255, 255, 0.05);
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
  color: #a0a0a0;
}

.arrow {
  font-size: 1.5rem;
  color: #808080;
}

.empty-message {
  margin: 0;
  padding: 20px;
  text-align: center;
  color: #888888;
}

/* Footer */
.home-footer {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  padding: 10px 20px;
  background: #2a2a2a;
  border-top: 1px solid #1a1a1a;
  font-size: 0.85rem;
  color: #a0a0a0;
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
