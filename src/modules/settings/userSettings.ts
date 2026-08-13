import type { UserSettings } from '../../types/settings'
import { detectLocaleFromNavigator, isSupportedLocale } from '../../i18n'
import { STORAGE_KEYS } from './storageKeys'
import { get, put } from '../storage/indexedDb'
import { DEFAULT_SHORTCUTS } from './defaultShortcuts'

export const defaultSettings: UserSettings = {
  locale: 'en',
  theme: 'dark',
  midiInputId: '',
  midiOutputId: '',
  musicDevicesAutoConnectInput: true,
  musicDevicesAutoConnectOutput: true,
  musicDevicesPreferBuiltInSynth: true,
  showKeyLabels: true,
  showNoteLabels: false,
  showFingerHints: true,
  showColoredFingerHints: true,
  keyLabelMode: 'octaves',
  noteLabelMode: 'octaves',
  keyLabelSize: 0,
  noteLabelSize: 0,
  showGrid: true,
  showFallingNotes: true,
  showSheetMusic: false,
  showKaraokeSub: true,
  showMyBookmarks: true,
  showMetadataBookmarks: true,
  showKeySignatureBookmarks: true,
  showMidiMarkers: true,
  defaultSpeed: 100,
  leadInDuration: 3,
  zoomPercent: 100,
  octaveShift: 0,
  libraryAutoPreviewEnabled: false,
  metronomeVolume: 0,
  metronomeDoubleSpeed: false,
  metronomeEmphasizeFirstBeat: true,
  folders: [],
  songsRescanOnStartup: false,
  songsRememberLastFolder: true,
  lastSelectedFolder: 'all',
  keyboardRangeMode: 'song-only',
  recordVideoSize: 'fhd',
  recordVideoOrientation: 'landscape',
  recordOutputVolume: 72,
  recordBackgroundAssetId: '',
  recordLogoAssetId: '',
  shortcutsPlayPauseKey: 'Space',
  shortcutsRestartKey: 'Backspace',
  shortcutsMetronomeKey: 'M',
  shortcutsToggleLabelsKey: 'L',
  shortcuts: DEFAULT_SHORTCUTS,
  advancedReduceAnimations: false,
  advancedEnableDebugOverlay: false,
  advancedConfirmBeforeDestructiveAction: true,
  advancedCompactMode: false,
  advancedMidiInstrumentChange: true,
  advancedMidiBankSelect: true,
  advancedMidiSysEx: true,
  advancedMidiPedal: true,
  advancedMidiZeroVolumeKeyLights: true,
  advancedMidiForceUniqueTrackChannels: true,
  advancedConverterMidiToMusicXml: 'music21',
  advancedConverterMusicXmlToMidi: 'webmscore',
}

function normalizeShortcuts(userShortcuts?: Record<string, Record<string, string[]>>): Record<string, Record<string, string[]>> {
  const merged: Record<string, Record<string, string[]>> = {}
  for (const [category, actions] of Object.entries(DEFAULT_SHORTCUTS)) {
    merged[category] = {}
    for (const [action, defaultKeys] of Object.entries(actions)) {
      const userKeys = userShortcuts?.[category]?.[action]
      merged[category][action] = Array.isArray(userKeys) ? userKeys : [...defaultKeys]
    }
  }
  return merged
}

function normalizeSettings(value?: Partial<UserSettings> | null): UserSettings {
  const locale = isSupportedLocale(value?.locale) ? value.locale : detectLocaleFromNavigator()
  const shortcuts = normalizeShortcuts(value?.shortcuts)
  return { ...defaultSettings, ...value, locale, shortcuts }
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const record = await get<{ key: string; value: UserSettings }>('settings', 'user-settings')
    return normalizeSettings(record?.value)
  } catch (error) {
    console.error('[Settings] Lỗi khi load từ IndexedDB, fallback về localStorage:', error)
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.settings) : null
    return raw ? normalizeSettings(JSON.parse(raw)) : normalizeSettings()
  }
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  try {
    await put('settings', { key: 'user-settings', value: settings })
  } catch (error) {
    console.error('[Settings] Lỗi khi save vào IndexedDB:', error)
    throw error
  }
}
