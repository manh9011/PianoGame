import { defineStore } from 'pinia'
import type { SupportedLocale } from '../i18n'
import { setI18nLocale } from '../i18n'
import type { LabelMode, KeyboardRangeMode, RecordVideoOrientation, RecordVideoSize, UserSettings } from '../types/settings'
import { loadSettings, saveSettings, defaultSettings } from '../modules/settings/userSettings'
import { clampLeadInDuration, clampZoomPercent, clampSpeed } from '../modules/game/playSession'
import { persistQueue } from '../modules/storage/indexedDb'

import { DEFAULT_SHORTCUTS, type ShortcutCategory, type ShortcutsConfig } from '../modules/settings/defaultShortcuts'

function updateThemeMetaColor(theme: 'dark' | 'light') {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f7fb' : '#202020')
}

function updateViewportMeta(compact: boolean) {
  const meta = document.querySelector('meta[name="viewport"]')
  if (!meta) return
  
  const targetWidth = compact ? 1920 : 1600
  meta.setAttribute('content', `width=${targetWidth}, viewport-fit=cover, user-scalable=no`)
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    ...defaultSettings,
    loading: false,
    initialized: false,
  }),
  actions: {
    async hydrate() {
      if (this.initialized) return
      this.loading = true
      try {
        const settings = await loadSettings()
        Object.assign(this.$state, settings, { initialized: true, loading: false })
        document.documentElement.dataset.theme = this.theme
        updateThemeMetaColor(this.theme)
        updateViewportMeta(this.advancedCompactMode)
        setI18nLocale(this.locale)
      } catch (error) {
        console.error('[Settings Store] Lỗi khi hydrate:', error)
        this.loading = false
      }
    },
    persist() {
      const { loading, initialized, ...settings } = this.$state
      const plainSettings = JSON.parse(JSON.stringify(settings))
      persistQueue.enqueue(() => saveSettings(plainSettings))
    },
    patchSettings(settings: Partial<UserSettings>) {
      Object.assign(this.$state, settings)
      if (settings.locale) setI18nLocale(settings.locale)
      if (settings.advancedCompactMode !== undefined) updateViewportMeta(settings.advancedCompactMode)
      this.persist()
    },
    setSpeed(v: number) { this.defaultSpeed = clampSpeed(v); this.persist() },
    setLeadInDuration(v: number) { this.leadInDuration = clampLeadInDuration(v); this.persist() },
    setZoomPercent(v: number) { this.zoomPercent = clampZoomPercent(v); this.persist() },
    setMetronomeVolume(v: number) { this.metronomeVolume = Math.max(0, Math.min(100, Math.round(v / 5) * 5)); this.persist() },
    setMetronomeDoubleSpeed(v: boolean) { this.metronomeDoubleSpeed = v; this.persist() },
    setMetronomeEmphasizeFirstBeat(v: boolean) { this.metronomeEmphasizeFirstBeat = v; this.persist() },
    setTheme(v: 'dark' | 'light') { this.theme = v; document.documentElement.dataset.theme = v; updateThemeMetaColor(v); this.persist() },
    setLocale(locale: SupportedLocale) { this.locale = locale; setI18nLocale(locale); this.persist() },
    setShowKeyLabels(show: boolean) { this.showKeyLabels = show; this.persist() },
    setShowNoteLabels(show: boolean) { this.showNoteLabels = show; this.persist() },
    setShowFingerHints(show: boolean) { this.showFingerHints = show; this.persist() },
    setShowColoredFingerHints(show: boolean) { this.showColoredFingerHints = show; this.persist() },
    setShowMyBookmarks(show: boolean) { this.showMyBookmarks = show; this.persist() },
    setShowMetadataBookmarks(show: boolean) { this.showMetadataBookmarks = show; this.persist() },
    setShowKeySignatureBookmarks(show: boolean) { this.showKeySignatureBookmarks = show; this.persist() },
    setShowMidiMarkers(show: boolean) { this.showMidiMarkers = show; this.persist() },
    setKeyLabelMode(mode: LabelMode) { this.keyLabelMode = mode; this.showKeyLabels = true; this.persist() },
    setNoteLabelMode(mode: LabelMode) { this.noteLabelMode = mode; this.showNoteLabels = true; this.persist() },
    setKeyLabelSize(size: number) { this.keyLabelSize = Math.max(-10, Math.min(25, size)); this.persist() },
    setNoteLabelSize(size: number) { this.noteLabelSize = Math.max(-10, Math.min(25, size)); this.persist() },
    setKeyboardRangeMode(mode: KeyboardRangeMode) { this.keyboardRangeMode = mode; this.persist() },
    setLibraryAutoPreviewEnabled(v: boolean) { this.libraryAutoPreviewEnabled = v; this.persist() },
    setRecordVideoSize(size: RecordVideoSize) { this.recordVideoSize = size; this.persist() },
    setRecordVideoOrientation(orientation: RecordVideoOrientation) { this.recordVideoOrientation = orientation; this.persist() },
    setRecordOutputVolume(volume: number) { this.recordOutputVolume = Math.max(0, Math.min(200, Math.round(volume))); this.persist() },
    setRecordBackgroundAssetId(assetId: string) { this.recordBackgroundAssetId = assetId; this.persist() },
    setRecordLogoAssetId(assetId: string) { this.recordLogoAssetId = assetId; this.persist() },
    setShortcutAction(category: ShortcutCategory, actionName: string, keys: string[]) {
      if (!this.shortcuts[category]) {
        this.shortcuts[category] = {}
      }
      this.shortcuts[category][actionName] = [...keys]
      this.persist()
    },
    resetActionShortcut(category: ShortcutCategory, actionName: string) {
      const defaultKeys = DEFAULT_SHORTCUTS[category]?.[actionName] ?? []
      if (!this.shortcuts[category]) {
        this.shortcuts[category] = {}
      }
      this.shortcuts[category][actionName] = [...defaultKeys]
      this.persist()
    },
    resetAllShortcuts() {
      this.shortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS))
      this.persist()
    },
    resetAdvancedSettings() {
      for (const key of Object.keys(defaultSettings) as (keyof typeof defaultSettings)[]) {
        if (key.startsWith('advanced')) {
          (this as any)[key] = defaultSettings[key]
        }
      }
      updateViewportMeta(this.advancedCompactMode)
      this.persist()
    },
  },
})
