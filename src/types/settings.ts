import type { SupportedLocale } from '../i18n'

export type LabelMode =
  | 'octaves'
  | 'finger-hint'
  | 'virtual-piano'
  | 'english'
  | 'fixed-do'
  | 'movable-do'
  | 'scale-number'
  | 'simple'

export type KeyboardRangeMode =
  | '18-keys'
  | '25-keys'
  | '88-keys'
  | 'my-notes'
  | 'my-keyboard'
  | 'song-only'
  | 'custom'

export interface UserSettings {
  locale: SupportedLocale
  theme: 'dark' | 'light'
  midiInputId: string
  midiOutputId: string
  musicDevicesAutoConnectInput: boolean
  musicDevicesAutoConnectOutput: boolean
  musicDevicesPreferBuiltInSynth: boolean
  showKeyLabels: boolean
  showNoteLabels: boolean
  showFingerHints: boolean
  showColoredFingerHints: boolean
  keyLabelMode: LabelMode
  noteLabelMode: LabelMode
  keyLabelSize: number
  noteLabelSize: number
  showGrid: boolean
  showFallingNotes: boolean
  showSheetMusic: boolean
  showMyBookmarks: boolean
  showMetadataBookmarks: boolean
  showKeySignatureBookmarks: boolean
  showMidiMarkers: boolean
  defaultSpeed: number
  showDuration: number
  octaveShift: number
  libraryAutoPreviewEnabled: boolean
  metronomeVolume: number
  metronomeDoubleSpeed: boolean
  metronomeEmphasizeFirstBeat: boolean
  folders: string[]
  songsRescanOnStartup: boolean
  songsRememberLastFolder: boolean
  songsSortByRecentlyImported: boolean
  keyboardRangeMode: KeyboardRangeMode
  shortcutsPlayPauseKey: string
  shortcutsRestartKey: string
  shortcutsMetronomeKey: string
  shortcutsToggleLabelsKey: string
  advancedReduceAnimations: boolean
  advancedEnableDebugOverlay: boolean
  advancedConfirmBeforeDestructiveAction: boolean
  advancedCompactMode: boolean
}
