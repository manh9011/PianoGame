import { onMounted, onUnmounted, ref } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import { requestMidiAccess, bindMidiMessageListener } from '../modules/midi/webMidi'

export type ShortcutActionMap = Record<string, (e?: Event | string) => void>

// Global pause flag for shortcuts (e.g. when capturing keys)
export const isShortcutsPaused = ref(false)

export function useShortcuts(actions: ShortcutActionMap) {
  const settingsStore = useSettingsStore()
  
  let unbindMidi: (() => void) | null = null

  const isFocusInInput = (target: EventTarget | null) => {
    if (!target) return false
    const el = target as HTMLElement
    const tagName = el.tagName?.toLowerCase()
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || el.isContentEditable
  }

  const triggerAction = (keyStr: string, originalEvent?: Event) => {
    if (isShortcutsPaused.value) return false
    
    const config = settingsStore.shortcuts
    if (!config) return false

    for (const category in config) {
      const categoryActions = config[category as keyof typeof config]
      for (const actionName in categoryActions) {
        if (categoryActions[actionName].includes(keyStr)) {
          if (actions[actionName]) {
            actions[actionName](originalEvent || keyStr)
            return true
          }
        }
      }
    }
    return false
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (isFocusInInput(event.target)) return
    if (event.defaultPrevented) return

    // Extract shortcut string
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

    const keyStr = parts.join('+')
    if (triggerAction(keyStr, event)) {
      event.preventDefault()
    }
  }

  const handleWheel = (event: WheelEvent) => {
    if (isFocusInInput(event.target)) return
    if (event.defaultPrevented) return

    const parts: string[] = []
    if (event.ctrlKey) parts.push('Ctrl')
    if (event.altKey) parts.push('Alt')
    if (event.shiftKey) parts.push('Shift')
    if (event.metaKey) parts.push('Meta')

    const baseName = 'Mouse Wheel'
    if (!parts.includes(baseName)) {
      parts.push(baseName)
    }

    const keyStr = parts.join('+')
    if (triggerAction(keyStr, event)) {
      event.preventDefault()
    }
  }

  onMounted(async () => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('wheel', handleWheel, { passive: false })
    
    try {
      const access = await requestMidiAccess({ sysex: true })
      if (access) {
        unbindMidi = bindMidiMessageListener(access, (mappedName) => {
          triggerAction(mappedName)
        })
      }
    } catch {
      // Ignore if MIDI not supported
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('wheel', handleWheel)
    if (unbindMidi) unbindMidi()
  })
}
