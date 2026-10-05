import type { SupportedLocale } from '../i18n'
import { ShortcutCategory } from '../modules/settings/defaultShortcuts'

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

export type RecordVideoSize = 'sd' | 'hd' | 'fhd' | '2k' | '4k'
export type RecordVideoOrientation = 'landscape' | 'portrait'

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
  showKaraokeSub: boolean
  showMyBookmarks: boolean
  showMetadataBookmarks: boolean
  showKeySignatureBookmarks: boolean
  showMidiMarkers: boolean
  defaultSpeed: number
  leadInDuration: number
  zoomPercent: number
  octaveShift: number
  libraryAutoPreviewEnabled: boolean
  metronomeVolume: number
  metronomeDoubleSpeed: boolean
  metronomeEmphasizeFirstBeat: boolean
  folders: string[]
  songsRescanOnStartup: boolean
  songsRememberLastFolder: boolean
  lastSelectedFolder?: string
  keyboardRangeMode: KeyboardRangeMode
  recordVideoSize: RecordVideoSize
  recordVideoOrientation: RecordVideoOrientation
  recordOutputVolume: number
  recordBackgroundAssetId: string
  recordLogoAssetId: string
  shortcutsPlayPauseKey: string
  shortcutsRestartKey: string
  shortcutsMetronomeKey: string
  shortcutsToggleLabelsKey: string
  shortcuts: Record<ShortcutCategory, Record<string, string[]>>
  advancedReduceAnimations: boolean
  advancedEnableDebugOverlay: boolean
  advancedConfirmBeforeDestructiveAction: boolean
  advancedCompactMode: boolean
  advancedMidiInstrumentChange: boolean
  advancedMidiBankSelect: boolean
  advancedMidiSysEx: boolean
  advancedMidiPedal: boolean
  advancedMidiZeroVolumeKeyLights: boolean
  advancedMidiForceUniqueTrackChannels: boolean
  advancedConverterMidiToMusicXml: 'music21' | 'music21-cloud' | 'webmscore'
  advancedConverterMusicXmlToMidi: 'verovio' | 'webmscore'
}
