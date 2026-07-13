import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LibraryView from '../views/LibraryView.vue'
import ModeSelectView from '../views/ModeSelectView.vue'
import TrackSettingsView from '../views/TrackSettingsView.vue'
import PlayView from '../views/PlayView.vue'
import SettingView from '../views/SettingView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/library', name: 'library', component: LibraryView },
    { path: '/mode-select/:hash', name: 'mode-select', component: ModeSelectView },
    { path: '/track-settings/:hash', name: 'track-settings', component: TrackSettingsView },
    { path: '/play/:hash/:modeId', name: 'play', component: PlayView },
    {
      path: '/settings',
      name: 'settings',
      component: SettingView,
      redirect: '/settings/music-devices',
      children: [
        { path: 'music-devices', name: 'settings-music-devices', component: () => import('../views/settings/SettingsMusicDevicesView.vue') },
        { path: 'songs', name: 'settings-songs', component: () => import('../views/settings/SettingsSongsView.vue') },
        { path: 'user-profiles', name: 'settings-user-profiles', component: () => import('../views/settings/SettingsUserProfilesView.vue') },
        { path: 'gameplay', name: 'settings-gameplay', component: () => import('../views/settings/SettingsGameplayView.vue') },
        { path: 'shortcuts', name: 'settings-shortcuts', component: () => import('../views/settings/SettingsShortcutsView.vue') },
        { path: 'color-theme', name: 'settings-color-theme', component: () => import('../views/settings/SettingsColorThemeView.vue') },
        { path: 'advanced', name: 'settings-advanced', component: () => import('../views/settings/SettingsAdvancedView.vue') },
        { path: 'unlock-synthesia', name: 'settings-unlock-synthesia', component: () => import('../views/settings/SettingsUnlockSynthesiaView.vue') },
      ],
    },
  ],
})
