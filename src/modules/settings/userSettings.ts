import type { UserSettings } from '../../types/settings'
import { detectLocaleFromNavigator, isSupportedLocale } from '../../i18n'
import { STORAGE_KEYS } from './storageKeys'
import { get, put } from '../storage/indexedDb'

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
  keyLabelMode: 'octaves',
  noteLabelMode: 'octaves',
  keyLabelSize: 0,
  noteLabelSize: 0,
  showGrid: true,
  showFallingNotes: true,
  showSheetMusic: false,
  showMyBookmarks: true,
  showMetadataBookmarks: true,
  showKeySignatureBookmarks: true,
  showMidiMarkers: true,
  defaultSpeed: 100,
  showDuration: 3.25,
  octaveShift: 0,
  metronomeVolume: 0,
  metronomeDoubleSpeed: false,
  metronomeEmphasizeFirstBeat: true,
  folders: [],
  songsRescanOnStartup: false,
  songsRememberLastFolder: true,
  songsSortByRecentlyImported: false,
  keyboardRangeMode: 'song-only',
  shortcutsPlayPauseKey: 'Space',
  shortcutsRestartKey: 'Backspace',
  shortcutsMetronomeKey: 'M',
  shortcutsToggleLabelsKey: 'L',
  advancedReduceAnimations: false,
  advancedEnableDebugOverlay: false,
  advancedConfirmBeforeDestructiveAction: true,
  advancedCompactMode: false,
}

function normalizeSettings(value?: Partial<UserSettings> | null): UserSettings {
  const locale = isSupportedLocale(value?.locale) ? value.locale : detectLocaleFromNavigator()
  return { ...defaultSettings, ...value, locale }
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const record = await get<{ key: string; value: UserSettings }>('settings', 'user-settings')
    return normalizeSettings(record?.value)
  } catch (error) {
    console.error('[Settings] Lỗi khi load từ IndexedDB, fallback về localStorage:', error)
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
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
