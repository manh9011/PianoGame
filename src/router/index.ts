import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/library', name: 'library', component: () => import('../views/LibraryView.vue') },
    { path: '/mode-select/:hash?', name: 'mode-select', component: () => import('../views/ModeSelectView.vue') },
    { path: '/track-settings/:hash?', name: 'track-settings', component: () => import('../views/TrackSettingsView.vue') },
    { path: '/play/:hash/:modeId', name: 'play', component: () => import('../views/PlayView.vue') },
    { path: '/record/:hash', name: 'record', component: () => import('../views/RecordView.vue') },
    { path: '/free-play', name: 'free-play', component: () => import('../views/FreePlayView.vue') },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingView.vue'),
      redirect: '/settings/music-devices',
      children: [
        { path: 'music-devices', name: 'settings-music-devices', component: () => import('../views/settings/SettingsMusicDevicesView.vue') },
        { path: 'songs', name: 'settings-songs', component: () => import('../views/settings/SettingsSongsView.vue') },
        { path: 'user-profiles', name: 'settings-user-profiles', component: () => import('../views/settings/SettingsUserProfilesView.vue') },
        { path: 'gameplay', name: 'settings-gameplay', component: () => import('../views/settings/SettingsGameplayView.vue') },
        { path: 'shortcuts', name: 'settings-shortcuts', component: () => import('../views/settings/SettingsShortcutsView.vue') },
        { path: 'color-theme', name: 'settings-color-theme', component: () => import('../views/settings/SettingsColorThemeView.vue') },
        { path: 'advanced', name: 'settings-advanced', component: () => import('../views/settings/SettingsAdvancedView.vue') },
      ],
    },
  ],
})
