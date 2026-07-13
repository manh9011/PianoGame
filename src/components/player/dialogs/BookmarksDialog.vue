<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { usePlayerStore } from '../../../stores/playerStore'
import { useSettingsStore } from '../../../stores/settingsStore'

interface Props {
  show: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const player = usePlayerStore()
const settings = useSettingsStore()

const editingId = ref<string | null>(null)
const editingLabel = ref('')

const userBookmarks = computed(() => player.session?.userBookmarks ?? [])

function formatTime(timeUs: number) {
  const totalSeconds = Math.max(0, timeUs / 1_000_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function goToBookmark(id: string) {
  player.seekToUserBookmark(id)
}

function startEdit(id: string, label: string) {
  editingId.value = id
  editingLabel.value = label
  nextTick(() => {
    const input = document.querySelector('.bookmark-edit-input') as HTMLInputElement
    input?.focus()
    input?.select()
  })
}

function saveEdit() {
  if (editingId.value && editingLabel.value.trim()) {
    player.updateUserBookmarkLabel(editingId.value, editingLabel.value.trim())
  }
  editingId.value = null
  editingLabel.value = ''
}

function cancelEdit() {
  editingId.value = null
  editingLabel.value = ''
}

function removeBookmark(id: string) {
  player.removeUserBookmark(id)
}

function clearAllUserBookmarks() {
  player.clearUserBookmarks()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="show" class="bookmarks-wrapper">
        <div class="bookmarks-container">
          <div class="bookmarks-dialog">
            <div class="bookmarks-list">
              <div class="bookmark-item my">
                <i class="fa fa-bookmark"></i>
                <span class="bookmark-label">My Bookmarks</span>
                <button
                  class="toggle-switch"
                  :class="{ active: settings.showMyBookmarks }"
                  @click="settings.setShowMyBookmarks(!settings.showMyBookmarks)"
                >
                  <span class="toggle-track"></span>
                  <span class="toggle-thumb"></span>
                </button>
              </div>

              <div class="bookmark-item metadata">
                <i class="fa fa-bookmark"></i>
                <span class="bookmark-label">Metadata Bookmarks</span>
                <button
                  class="toggle-switch"
                  :class="{ active: settings.showMetadataBookmarks }"
                  @click="settings.setShowMetadataBookmarks(!settings.showMetadataBookmarks)"
                >
                  <span class="toggle-track"></span>
                  <span class="toggle-thumb"></span>
                </button>
              </div>

              <div class="bookmark-item key-signature">
                <i class="fa fa-bookmark"></i>
                <span class="bookmark-label">Key Signatures</span>
                <button
                  class="toggle-switch"
                  :class="{ active: settings.showKeySignatureBookmarks }"
                  @click="settings.setShowKeySignatureBookmarks(!settings.showKeySignatureBookmarks)"
                >
                  <span class="toggle-track"></span>
                  <span class="toggle-thumb"></span>
                </button>
              </div>

              <div class="bookmark-item midi-marker">
                <i class="fa fa-bookmark"></i>
                <span class="bookmark-label">MIDI Markers</span>
                <button
                  class="toggle-switch"
                  :class="{ active: settings.showMidiMarkers }"
                  @click="settings.setShowMidiMarkers(!settings.showMidiMarkers)"
                >
                  <span class="toggle-track"></span>
                  <span class="toggle-thumb"></span>
                </button>
              </div>
            </div>

            <p class="info-text">
              Set bookmarks in the left margin.
              <br>
              Double-click to rename the bookmark.
            </p>

            <div v-if="userBookmarks.length > 0" class="user-bookmarks-section">
              <div class="section-header">
                <span class="section-title">My Bookmarks</span>
                <span class="section-count">{{ userBookmarks.length }}</span>
              </div>
              <div class="user-bookmarks-list">
                <div
                  v-for="bookmark in userBookmarks"
                  :key="bookmark.id"
                  class="user-bookmark-item"
                >
                  <button class="bookmark-go-btn" @click="goToBookmark(bookmark.id)" title="Nhảy tới bookmark">
                    <i class="fas fa-play"></i>
                  </button>
                  <div class="bookmark-info" @dblclick="startEdit(bookmark.id, bookmark.label)">
                    <template v-if="editingId === bookmark.id">
                      <input
                        v-model="editingLabel"
                        class="bookmark-edit-input"
                        @keyup.enter="saveEdit"
                        @keyup.escape="cancelEdit"
                        @blur="saveEdit"
                      />
                    </template>
                    <template v-else>
                      <span class="bookmark-name">{{ bookmark.label }}</span>
                      <span class="bookmark-time">{{ formatTime(bookmark.timeUs) }}</span>
                    </template>
                  </div>
                  <button class="bookmark-delete-btn" @click="removeBookmark(bookmark.id)" title="Xóa bookmark">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <button class="clear-bookmarks-btn" @click="clearAllUserBookmarks">
                <i class="fas fa-trash"></i>
                Clear User Bookmarks
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bookmarks-wrapper {
  position: fixed;
  bottom: 1rem;
  left: 2rem;
  z-index: 100;
  pointer-events: none;
}

.bookmarks-container {
  width: 400px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: #3a3d42;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  pointer-events: auto;
}

.bookmarks-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  max-height: min(90vh, 500px);
  overflow-y: auto;
}

.bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bookmark-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.bookmark-item i {
  width: 16px;
  text-align: center;
}

.bookmark-item.my i {
  color: #FFBB32;
}

.bookmark-item.metadata i {
  color: #FF7F00;
}

.bookmark-item.key-signature i {
  color: #a855f7;
}

.bookmark-item.midi-marker i {
  color: #22d3ee;
}

.bookmark-label {
  flex: 1;
  color: #e3e4e8;
  font-size: 0.95rem;
  font-weight: 500;
}

.toggle-switch {
  position: relative;
  width: 50px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.toggle-track {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: #5a5c61;
  transition: background 0.3s ease;
}

.toggle-switch.active .toggle-track {
  background: #4ade80;
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(22px);
}

.user-bookmarks-section {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  padding: 0 0.25rem;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #FFBB32;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-count {
  font-size: 0.75rem;
  color: #9ca3af;
  background: rgba(255, 187, 50, 0.2);
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
}

.user-bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 200px;
  overflow-y: auto;
}

.user-bookmark-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  background: rgba(255, 187, 50, 0.08);
  border: 1px solid rgba(255, 187, 50, 0.15);
  transition: all 0.15s ease;
}

.user-bookmark-item:hover {
  background: rgba(255, 187, 50, 0.15);
  border-color: rgba(255, 187, 50, 0.25);
}

.bookmark-go-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 187, 50, 0.2);
  color: #FFBB32;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.bookmark-go-btn:hover {
  background: #FFBB32;
  color: #1a1a1a;
}

.bookmark-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  cursor: default;
}

.bookmark-name {
  font-size: 0.9rem;
  color: #e3e4e8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.bookmark-edit-input {
  width: 100%;
  padding: 0.25rem 0.4rem;
  border: 1px solid #FFBB32;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: #e3e4e8;
  font-size: 0.9rem;
  outline: none;
}

.bookmark-delete-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.bookmark-delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.clear-bookmarks-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.6rem 1rem;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 0.85rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-bookmarks-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.info-text {
  margin: 0;
  padding: 0.75rem 1rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.85rem;
  line-height: 1.4;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 6px;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
