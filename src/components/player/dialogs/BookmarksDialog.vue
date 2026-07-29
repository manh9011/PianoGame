<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../../stores/playerStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import BaseToggle from '../../ui/BaseToggle.vue'
import BaseButton from '../../ui/BaseButton.vue'
import BaseInput from '../../ui/BaseInput.vue'

interface Props {
  show: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
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
                <span class="bookmark-label">{{ t('dialogs.myBookmarks') }}</span>
                <BaseToggle :model-value="settings.showMyBookmarks" @update:model-value="(v) => settings.setShowMyBookmarks(v)" />
              </div>

              <div class="bookmark-item metadata">
                <i class="fa fa-bookmark"></i>
                <span class="bookmark-label">{{ t('dialogs.metadataBookmarks') }}</span>
                <BaseToggle :model-value="settings.showMetadataBookmarks" @update:model-value="(v) => settings.setShowMetadataBookmarks(v)" />
              </div>

              <div class="bookmark-item key-signature">
                <i class="fa fa-bookmark"></i>
                <span class="bookmark-label">{{ t('dialogs.keySignatures') }}</span>
                <BaseToggle :model-value="settings.showKeySignatureBookmarks" @update:model-value="(v) => settings.setShowKeySignatureBookmarks(v)" />
              </div>

              <div class="bookmark-item midi-marker">
                <i class="fa fa-bookmark"></i>
                <span class="bookmark-label">{{ t('dialogs.midiMarkers') }}</span>
                <BaseToggle :model-value="settings.showMidiMarkers" @update:model-value="(v) => settings.setShowMidiMarkers(v)" />
              </div>
            </div>

            <p class="info-text">
              {{ t('dialogs.bookmarkHintSet') }}
              <br>
              {{ t('dialogs.bookmarkHintRename') }}
            </p>

            <div v-if="userBookmarks.length > 0" class="user-bookmarks-section">
              <div class="section-header">
                <span class="section-title">{{ t('dialogs.myBookmarks') }}</span>
                <span class="section-count">{{ userBookmarks.length }}</span>
              </div>
              <div class="user-bookmarks-list">
                <div
                  v-for="bookmark in userBookmarks"
                  :key="bookmark.id"
                  class="user-bookmark-item"
                >
                  <BaseButton variant="icon" @click="goToBookmark(bookmark.id)" :title="t('dialogs.goToBookmark')">
                    <i class="fas fa-play"></i>
                  </BaseButton>
                  <div class="bookmark-info" @dblclick="startEdit(bookmark.id, bookmark.label)">
                    <template v-if="editingId === bookmark.id">
                      <BaseInput
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
                  <BaseButton variant="icon" @click="removeBookmark(bookmark.id)" :title="t('dialogs.deleteBookmark')">
                    <i class="fas fa-times"></i>
                  </BaseButton>
                </div>
              </div>
              <BaseButton variant="danger" class="clear-bookmarks-btn" @click="clearAllUserBookmarks">
                <i class="fas fa-trash"></i>
                {{ t('dialogs.clearUserBookmarks') }}
              </BaseButton>
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
  inset-inline-start: 2rem;
  z-index: 100;
  pointer-events: none;
}

.bookmarks-container {
  width: 400px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  pointer-events: auto;
}

.bookmarks-dialog {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  max-height: min(90dvh, 500px);
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
  color: var(--color-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
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
  color: var(--color-text-secondary);
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
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-time {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.bookmark-edit-input {
  width: 100%;
  padding: 0.25rem 0.4rem;
  border: 1px solid #FFBB32;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  outline: none;
}

.clear-bookmarks-btn {
  width: 100%;
  margin-top: 0.5rem;
}

.info-text {
  margin: 0;
  padding: 0.75rem 1rem;
  text-align: center;
  color: var(--color-text-secondary);
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

