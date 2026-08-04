import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'assets/*.woff2',
        'assets/*.js',
        'assets/*.css',
        'flags/*.png',
        'instruments/*.png',
        'keys/*.svg',
        'keys/*.png',
        'soundfonts/*/*.js',
        'sounds/*.mid',
        'favicon.ico'
      ],
      manifest: {
        name: 'Piano Game',
        short_name: 'Piano Game',
        description: 'Piano practice game',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#202020',
        theme_color: '#202020',
        icons: [
          {
            src: 'icons/pwa-128x128.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-256x256.png',
            sizes: '256x256',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mid,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  assetsInclude: ['**/*.mid'],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
