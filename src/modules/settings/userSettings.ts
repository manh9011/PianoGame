import type { UserSettings } from '../../types/settings'
import { STORAGE_KEYS } from './storageKeys'
import { get, put } from '../storage/indexedDb'

export const defaultSettings: UserSettings = {
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
  unlockSynthesiaEmail: '',
  unlockSynthesiaLicenseKey: '',
  unlockSynthesiaRememberDevice: true,
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const record = await get<{ key: string; value: UserSettings }>('settings', 'user-settings')
    return record?.value ? { ...defaultSettings, ...record.value } : { ...defaultSettings }
  } catch (error) {
    console.error('[Settings] Lỗi khi load từ IndexedDB, fallback về localStorage:', error)
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings }
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
