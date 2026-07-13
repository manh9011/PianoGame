export interface SettingsNavigationItem {
  label: string
  icon: string
  to: string
  routeName: string
}

export const settingsNavigation: SettingsNavigationItem[] = [
  { label: 'Music Devices', icon: 'fa-solid fa-music', to: '/settings/music-devices', routeName: 'settings-music-devices' },
  { label: 'Songs', icon: 'fa-solid fa-folder-open', to: '/settings/songs', routeName: 'settings-songs' },
  { label: 'User Profiles', icon: 'fa-solid fa-user', to: '/settings/user-profiles', routeName: 'settings-user-profiles' },
  { label: 'Gameplay', icon: 'fa-solid fa-gamepad', to: '/settings/gameplay', routeName: 'settings-gameplay' },
  { label: 'Shortcuts', icon: 'fa-solid fa-keyboard', to: '/settings/shortcuts', routeName: 'settings-shortcuts' },
  { label: 'Color Theme', icon: 'fa-solid fa-palette', to: '/settings/color-theme', routeName: 'settings-color-theme' },
  { label: 'Advanced', icon: 'fa-solid fa-sliders', to: '/settings/advanced', routeName: 'settings-advanced' },
  { label: 'Unlock Synthesia', icon: 'fa-solid fa-lock-open', to: '/settings/unlock-synthesia', routeName: 'settings-unlock-synthesia' },
]
