export interface SettingsNavigationItem {
  labelKey: string
  icon: string
  to: string
  routeName: string
}

export const settingsNavigation: SettingsNavigationItem[] = [
  { labelKey: 'settings.musicDevices', icon: 'fa-solid fa-music', to: '/settings/music-devices', routeName: 'settings-music-devices' },
  { labelKey: 'settings.songs', icon: 'fa-solid fa-folder-open', to: '/settings/songs', routeName: 'settings-songs' },
  { labelKey: 'settings.userProfiles', icon: 'fa-solid fa-user', to: '/settings/user-profiles', routeName: 'settings-user-profiles' },
  { labelKey: 'settings.gameplay', icon: 'fa-solid fa-gamepad', to: '/settings/gameplay', routeName: 'settings-gameplay' },
  { labelKey: 'settings.shortcuts', icon: 'fa-solid fa-keyboard', to: '/settings/shortcuts', routeName: 'settings-shortcuts' },
  { labelKey: 'settings.colorTheme', icon: 'fa-solid fa-palette', to: '/settings/color-theme', routeName: 'settings-color-theme' },
  { labelKey: 'settings.advanced', icon: 'fa-solid fa-sliders', to: '/settings/advanced', routeName: 'settings-advanced' },
]
