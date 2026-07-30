<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import { useSettingsStore } from '../../stores/settingsStore'
import { DEFAULT_SHORTCUTS } from '../../modules/settings/defaultShortcuts'
import { requestMidiAccess, bindMidiMessageListener } from '../../modules/midi/webMidi'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const activeAction = ref<{ category: string; actionName: string } | null>(null)
const isModalOpen = ref(false)
const editingIndex = ref<number | null>(null)
const capturedKey = ref('')

let unbindMidiListener: (() => void) | null = null

const shortcutsConfig = computed(() => {
  return settingsStore.shortcuts || DEFAULT_SHORTCUTS
})

const currentActionKeys = computed(() => {
  if (!activeAction.value) return []
  const { category, actionName } = activeAction.value
  return shortcutsConfig.value[category]?.[actionName] ?? []
})

function selectAction(category: string, actionName: string) {
  closeCaptureModal()
  activeAction.value = { category, actionName }
}

function backToOverview() {
  closeCaptureModal()
  activeAction.value = null
}

async function openCaptureModal(index: number) {
  editingIndex.value = index
  if (index < currentActionKeys.value.length) {
    capturedKey.value = currentActionKeys.value[index]
  } else {
    capturedKey.value = ''
  }
  isModalOpen.value = true
  window.addEventListener('keydown', handleModalKeyDown, true)
  window.addEventListener('wheel', handleModalWheel, { passive: false, capture: true })

  try {
    const access = await requestMidiAccess({ sysex: true })
    if (access && isModalOpen.value) {
      if (unbindMidiListener) unbindMidiListener()
      unbindMidiListener = bindMidiMessageListener(access, (mappedName) => {
        if (isModalOpen.value && mappedName) {
          capturedKey.value = mappedName
        }
      })
    }
  } catch {
    // SysEx or Web MIDI not available
  }
}

function closeCaptureModal() {
  isModalOpen.value = false
  editingIndex.value = null
  capturedKey.value = ''
  window.removeEventListener('keydown', handleModalKeyDown, true)
  window.removeEventListener('wheel', handleModalWheel, { capture: true } as any)
  if (unbindMidiListener) {
    unbindMidiListener()
    unbindMidiListener = null
  }
}

function handleModalWheel(event: WheelEvent) {
  if (!isModalOpen.value) return

  event.preventDefault()
  event.stopPropagation()

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')

  const baseName = 'Mouse Wheel'
  if (!parts.includes(baseName)) {
    parts.push(baseName)
  }

  capturedKey.value = parts.join('+')
}

function handleModalKeyDown(event: KeyboardEvent) {
  if (!isModalOpen.value) return

  event.preventDefault()
  event.stopPropagation()

  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
    return
  }

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')

  let keyName = event.key
  if (event.code === 'Space' || keyName === ' ') keyName = 'Space'
  else if (keyName === 'ArrowUp') keyName = 'Up'
  else if (keyName === 'ArrowDown') keyName = 'Down'
  else if (keyName === 'ArrowLeft') keyName = 'Left'
  else if (keyName === 'ArrowRight') keyName = 'Right'
  else if (keyName === 'PageUp') keyName = 'Page Up'
  else if (keyName === 'PageDown') keyName = 'Page Down'
  else if (keyName === 'Backspace') keyName = 'Backspace'
  else if (keyName === 'Enter') keyName = 'Enter'
  else if (keyName === 'Tab') keyName = 'Tab'
  else if (keyName === 'MediaPlayPause') keyName = 'Play/Pause'
  else if (keyName === 'MediaTrackPrevious') keyName = 'Previous Track'
  else if (keyName === 'MediaTrackNext') keyName = 'Next Track'
  else if (keyName === 'BrowserForward') keyName = 'Forward'
  else if (keyName === 'BrowserBack') keyName = 'Back'
  else if (keyName.length === 1) {
    keyName = keyName.toUpperCase()
  }

  if (!parts.includes(keyName)) {
    parts.push(keyName)
  }

  capturedKey.value = parts.join('+')
}

function saveCapturedModal() {
  if (editingIndex.value !== null && capturedKey.value.trim()) {
    saveShortcutKey(editingIndex.value, capturedKey.value.trim())
  }
  closeCaptureModal()
}

function deleteCapturedModal() {
  if (editingIndex.value !== null && editingIndex.value < currentActionKeys.value.length) {
    removeShortcutKey(editingIndex.value)
  }
  closeCaptureModal()
}

function saveShortcutKey(index: number, keyStr: string) {
  if (!activeAction.value || !keyStr.trim()) return
  const { category, actionName } = activeAction.value
  const newKeys = [...currentActionKeys.value]

  if (index >= 0 && index < newKeys.length) {
    newKeys[index] = keyStr.trim()
  } else {
    newKeys.push(keyStr.trim())
  }

  const uniqueKeys = Array.from(new Set(newKeys))
  settingsStore.setShortcutAction(category, actionName, uniqueKeys)
}

function removeShortcutKey(index: number) {
  if (!activeAction.value) return
  const { category, actionName } = activeAction.value
  const newKeys = currentActionKeys.value.filter((_, i) => i !== index)
  settingsStore.setShortcutAction(category, actionName, newKeys)
}

function addNewShortcut() {
  if (!activeAction.value) return
  const newIndex = currentActionKeys.value.length
  openCaptureModal(newIndex)
}

function resetCurrentAction() {
  if (!activeAction.value) return
  const { category, actionName } = activeAction.value
  settingsStore.resetActionShortcut(category, actionName)
  closeCaptureModal()
}

function handleResetAll() {
  settingsStore.resetAllShortcuts()
  closeCaptureModal()
}

function getActionLabel(actionName: string): string {
  return t(`settings.shortcutActions.${actionName}`, actionName)
}

function getCategoryLabel(categoryName: string): string {
  return t(`settings.shortcutCategories.${categoryName}`, categoryName)
}

watch(activeAction, () => {
  closeCaptureModal()
})

onUnmounted(() => {
  closeCaptureModal()
})
</script>

<template>
  <div class="settings-page shortcuts-page">
    <!-- OVERVIEW SCREEN: CATEGORY LIST -->
    <template v-if="!activeAction">
      <header class="settings-page-title">
        <div>
          <h2>{{ t('settings.shortcuts') }}</h2>
          <p>{{ t('settings.shortcutsDescription') }}</p>
        </div>
        <button class="settings-button danger text-sm" type="button" @click="handleResetAll">
          {{ t('settings.resetAllShortcuts') }}
        </button>
      </header>

      <div class="category-sections">
        <SettingsSection
          v-for="(actions, categoryName) in shortcutsConfig"
          :key="categoryName"
          :title="getCategoryLabel(String(categoryName))"
        >
          <div
            v-for="(_, actionName) in actions"
            :key="actionName"
            class="shortcut-overview-row"
            @click="selectAction(String(categoryName), String(actionName))"
          >
            <SettingsRow :title="getActionLabel(String(actionName))">
              <div class="shortcut-badges">
                <span
                  v-if="shortcutsConfig[categoryName]?.[actionName]?.length"
                  class="shortcut-text-list"
                >
                  {{ shortcutsConfig[categoryName][actionName].join(', ') }}
                </span>
                <span v-else class="empty-badge">(none)</span>
                <i class="fa-solid fa-chevron-right row-arrow" aria-hidden="true" />
              </div>
            </SettingsRow>
          </div>
        </SettingsSection>
      </div>
    </template>

    <!-- DETAIL SCREEN: BINDING EDITOR MATCHING SCREENSHOT -->
    <template v-else>
      <header class="detail-header">
        <button class="header-back-btn" type="button" @click="backToOverview">
          <i class="fa-solid fa-chevron-left" aria-hidden="true" />
          <span>{{ t('settings.title') }}</span>
        </button>
        <h2 class="detail-title">{{ getActionLabel(activeAction.actionName) }}</h2>
        <div class="detail-header-spacer"></div>
      </header>

      <main class="detail-container">
        <!-- SHORTCUTS LIST CARD -->
        <div class="shortcuts-card">
          <template v-if="currentActionKeys.length > 0">
            <div
              v-for="(keyStr, index) in currentActionKeys"
              :key="index"
              class="shortcut-card-row"
              @click="openCaptureModal(index)"
            >
              <div class="shortcut-key-label">
                <span class="key-name">{{ keyStr }}</span>
              </div>
            </div>
          </template>

          <div v-else class="empty-card-row">
            <span>{{ t('settings.noShortcuts') }}</span>
          </div>
        </div>

        <!-- BOTTOM TOOLBAR MATCHING SCREENSHOT -->
        <footer class="detail-actions">
          <div class="right-actions">
            <button class="action-btn-danger" type="button" @click="resetCurrentAction">
              {{ t('settings.resetToDefaults') }}
            </button>
            <button class="action-btn-add" type="button" :title="t('settings.addShortcut')" @click="addNewShortcut">
              <i class="fa-solid fa-plus" aria-hidden="true" />
            </button>
          </div>
        </footer>
      </main>
    </template>

    <!-- KEY CAPTURE DIALOG MATCHING SECOND SCREENSHOT -->
    <Teleport to="body">
      <div v-if="isModalOpen" class="modal-backdrop" @click.self="closeCaptureModal">
        <div class="modal-dialog">
          <header class="modal-header">
            <button class="modal-nav-btn" type="button" @click="closeCaptureModal">
              {{ t('common.cancel') }}
            </button>
            <button class="modal-nav-btn" type="button" @click="saveCapturedModal">
              {{ t('common.save') }}
            </button>
          </header>

          <main class="modal-inner-card">
            <p class="modal-instruction">{{ t('settings.hitAnyControl') }}</p>
            <div class="modal-key-display">
              <span>{{ capturedKey || '...' }}</span>
            </div>

          </main>

          <footer class="modal-footer">
            <button class="modal-btn-delete" type="button" @click="deleteCapturedModal">
              {{ t('settings.deleteShortcut') }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.shortcuts-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.category-sections {
  display: grid;
  gap: 1rem;
}

.shortcut-overview-row {
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid var(--color-border-subtle);
}

.shortcut-overview-row:last-child {
  border-bottom: none;
}

.shortcut-overview-row:hover {
  background: var(--color-row-hover);
}

.shortcut-overview-row :deep(.settings-row) {
  border-bottom: none;
}

.shortcut-badges {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.shortcut-text-list {
  color: var(--color-text-secondary);
  font-size: 0.88rem;
}

.empty-badge {
  color: var(--color-text-muted);
  font-size: 0.84rem;
  font-style: italic;
}

.row-arrow {
  color: var(--color-accent-amber);
  font-size: 0.82rem;
  margin-left: 0.35rem;
}

/* DETAIL HEADER */
.detail-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 0.2rem 0.1rem 0.6rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.header-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.34rem 0.75rem;
  border: 1px solid var(--color-border-default);
  border-radius: 0.38rem;
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  font-size: 0.84rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.header-back-btn:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-strong);
}

.detail-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.15rem;
  font-weight: 500;
  text-align: center;
}

.detail-header-spacer {
  min-width: 5rem;
}

/* DETAIL CONTAINER */
.detail-container {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

/* CARD MATCHING USER SCREENSHOT */
.shortcuts-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-default);
  border-radius: 0.45rem;
  background: var(--color-bg-card);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.shortcut-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.72rem 1.1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.12s ease;
}

.shortcut-card-row:last-child {
  border-bottom: none;
}

.shortcut-card-row:hover {
  background: var(--color-bg-card-hover);
}

.shortcut-key-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.94rem;
}

.key-name {
  font-weight: 400;
}

.empty-card-row {
  padding: 1.5rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.88rem;
  font-style: italic;
}

/* BOTTOM TOOLBAR MATCHING SCREENSHOT */
.detail-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 0.2rem;
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.action-btn-danger {
  padding: 0.48rem 1.1rem;
  border: none;
  border-radius: 0.4rem;
  background: #aa2a2a;
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.action-btn-danger:hover {
  background: #c23333;
}

.action-btn-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.7rem;
  height: 2.2rem;
  padding: 0 0.8rem;
  border: 1px solid var(--color-border-default);
  border-radius: 0.4rem;
  background: #5a5a5a;
  color: #ffffff;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.action-btn-add:hover {
  background: #6e6e6e;
}

/* KEY CAPTURE MODAL MATCHING USER SECOND SCREENSHOT */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-dialog {
  width: min(92vw, 24rem);
  padding: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 0.55rem;
  background: #464646;
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  color: #ffffff;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-nav-btn {
  padding: 0.24rem 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.28rem;
  background: #363636;
  color: #e0e0e0;
  font-size: 0.84rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.modal-nav-btn:hover {
  background: #444444;
  color: #ffffff;
}

.modal-inner-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.8rem 1rem 1.4rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.42rem;
  background: #333333;
  text-align: center;
}

.modal-instruction {
  margin: 0 0 1.2rem;
  color: #d0d0d0;
  font-size: 0.92rem;
  font-weight: 400;
}

.modal-key-display {
  margin: 0 0 1rem;
  min-height: 2.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 2rem;
  font-weight: 600;
}

.modal-special-toggle {
  margin-top: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.6rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.76rem;
  cursor: pointer;
}

.modal-special-toggle:hover {
  color: #ffffff;
}

.modal-special-select {
  width: 100%;
  margin-top: 0.5rem;
}

.modal-footer {
  display: flex;
}

.modal-btn-delete {
  width: 100%;
  padding: 0.55rem;
  border: none;
  border-radius: 0.38rem;
  background: #a32626;
  color: #ffffff;
  font-size: 1.02rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.modal-btn-delete:hover {
  background: #bb2c2c;
}

@media (max-width: 640px) {
  .detail-header {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .detail-header-spacer {
    display: none;
  }
  .detail-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .right-actions {
    margin-left: 0;
    justify-content: flex-end;
  }
}
</style>
