import { defineStore } from 'pinia'
import type { SupportedLocale } from '../i18n'
import { setI18nLocale } from '../i18n'
import type { LabelMode, KeyboardRangeMode, UserSettings } from '../types/settings'
import { loadSettings, saveSettings, defaultSettings } from '../modules/settings/userSettings'
import { clampShowDuration, clampSpeed } from '../modules/game/playSession'
import { persistQueue } from '../modules/storage/indexedDb'

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
      this.persist()
    },
    setSpeed(v: number) { this.defaultSpeed = clampSpeed(v); this.persist() },
    setShowDuration(v: number) { this.showDuration = clampShowDuration(v); this.persist() },
    setMetronomeVolume(v: number) { this.metronomeVolume = Math.max(0, Math.min(100, Math.round(v / 5) * 5)); this.persist() },
    setMetronomeDoubleSpeed(v: boolean) { this.metronomeDoubleSpeed = v; this.persist() },
    setMetronomeEmphasizeFirstBeat(v: boolean) { this.metronomeEmphasizeFirstBeat = v; this.persist() },
    setTheme(v: 'dark' | 'light') { this.theme = v; document.documentElement.dataset.theme = v; this.persist() },
    setLocale(locale: SupportedLocale) { this.locale = locale; setI18nLocale(locale); this.persist() },
    setShowKeyLabels(show: boolean) { this.showKeyLabels = show; this.persist() },
    setShowNoteLabels(show: boolean) { this.showNoteLabels = show; this.persist() },
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
  },
})
