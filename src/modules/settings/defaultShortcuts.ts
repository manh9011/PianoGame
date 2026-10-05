export type ShortcutCategory =
  | 'menuNavigation'
  | 'menuSelection'
  | 'songNavigation'
  | 'playControls'
  | 'freePlay'
  | 'bookmarks'
  | 'loops'
  | 'fingerHints'
  | 'advanced'

export type ShortcutsConfig = Record<ShortcutCategory, Record<string, string[]>>

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  menuNavigation: {
    menuContinue: ['Enter', 'Forward'],
    menuBack: ['Escape', 'Back'],
    exit: [],
  },
  menuSelection: {
    menuSelectNextItem: ['Down'],
    menuSelectPreviousItem: ['Up'],
    menuNextPage: ['Page Down'],
    menuPreviousPage: ['Page Up'],
    navigateUpSongGroup: [],
  },
  songNavigation: {
    speedUp: ['Up'],
    speedDown: ['Down'],
    speedUpSmallStep: ['Ctrl+Up'],
    speedDownSmallStep: ['Ctrl+Down'],
    speedVariable: ['Ctrl+Mouse Wheel'],
    stepBackward: ['Left', 'Previous Track', 'MMC Rewind'],
    stepForward: ['Right', 'Next Track', 'MMC Fast Forward'],
    songPositionJog: [],
    absoluteSongPosition: ['Mouse Wheel'],
  },
  playControls: {
    showGameHelp: ['F1'],
    pauseResume: ['Space', 'MMC Play', 'Play/Pause'],
    toggleBookmarkEditingMode: ['B'],
    toggleLoopEditingMode: ['V'],
    toggleFingerHintEditingMode: ['N'],
    stretchFallingNoteDisplay: ['Page Up'],
    compressFallingNoteDisplay: ['Page Down'],
    resetFallingNoteScale: [],
    shiftInputOctaveUp: ['X'],
    shiftInputOctaveDown: ['Z'],
    toggleSheetMusic: ['F2'],
    adjustSheetMusicSize: ['F3'],
    toggleFallingMeasureLines: ['F4'],
    toggleFallingNotes: ['F5'],
    cycleOutputMidiChannel: [],
  },
  freePlay: {
    startStopRecording: ['MMC Record', 'Strobe'],
  },
  bookmarks: {
    previousBookmark: ['Comma'],
    nextBookmark: ['Period'],
    toggleBookmarkCurrentPosition: [';'],
    jumpToBeginningSong: ['1'],
    jumpToBookmark1: ['2'],
    jumpToBookmark2: ['3'],
    jumpToBookmark4: ['5'],
    jumpToBookmark3: ['4'],
    jumpToBookmark5: ['6'],
    jumpToBookmark6: ['7'],
    jumpToBookmark7: ['8'],
    jumpToBookmark8: ['9'],
    jumpToBookmark9: ['0'],
  },
  loops: {
    walkLoopForward: ['>'],
    walkLoopBackward: ['<'],
    extendLoopEndForward: ['Ctrl+Period'],
    extendLoopStartBackward: ['Ctrl+Comma'],
    toggleLoop: ['/'],
    restartLoop: ['Backspace'],
  },
  fingerHints: {
    toggleLeftFinger1: ['1'],
    toggleLeftFinger2: ['2'],
    toggleLeftFinger3: ['3'],
    toggleLeftFinger4: ['4'],
    toggleLeftFinger5: ['5'],
    toggleRightFinger1: ['6', '!'],
    toggleRightFinger2: ['7', '@'],
    toggleRightFinger3: ['8', '#'],
    toggleRightFinger4: ['9', '$'],
    toggleRightFinger5: ['0', '%'],
    removeFingerHint: ['`'],
  },
  advanced: {
    toggleFullScreen: ['Alt+Enter', 'F11'],
    toggleFpsDisplay: ['F6'],
    toggleVerboseLogging: ['F7'],
  },
}
