<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '../ui/BaseButton.vue'

const { t } = useI18n()

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const links = [
  { name: 'Youtube', url: 'https://youtube.com/@MLX-Piano', domain: 'youtube.com' },
  { name: 'Facebook', url: 'https://facebook.com/mlx.piano', domain: 'facebook.com' },
  { name: 'GitHub', url: 'https://github.com/manh9011', domain: 'github.com' },

  { name: 'Musescore', url: 'https://manh9011.qzz.io', domain: 'musescore.com' },
  { name: 'Itch.IO', url: 'https://manh9011.itch.io', domain: 'itch.io' },
  { name: 'Buy Me A Coffee', url: 'https://www.buymeacoffee.com/manh9011', domain: 'buymeacoffee.com' },

  { name: 'MyMusic5', url: 'https://mymusic5.com/manh9011', domain: 'mymusic5.com' },
  { name: 'KoKoMusic', url: 'https://www.kokomu.jp/artist/manh9011', domain: 'kokomu.jp' },
  { name: 'Mapiainist', url: 'https://www.mapianist.com/profile/1405145', domain: 'mapianist.com' },
]

function openLink(url: string) {
  window.open(url, '_blank')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="about-overlay" @click="emit('close')">
      <div class="about-dialog" @click.stop>
        <header class="about-header">
          <h2>{{ t('home.about') }}</h2>
          <button class="close-button" @click="emit('close')">×</button>
        </header>

        <main class="about-content">
          <p class="summary">
            {{ t('home.aboutSummary') }}
          </p>

          <div class="links-grid">
            <BaseButton v-for="link in links" :key="link.name" variant="secondary" class="link-button"
              @click="openLink(link.url)">
              <img :src="`https://www.google.com/s2/favicons?domain=${link.domain}&sz=64`" class="favicon" alt="" />
              <span>{{ link.name }}</span>
            </BaseButton>
          </div>
        </main>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.about-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.about-dialog {
  background: var(--color-bg-primary);
  border-radius: 8px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-default);
}

.about-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.about-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-text-primary);
}

.close-button {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-button:hover {
  color: var(--color-text-primary);
}

.about-content {
  padding: 20px;
  overflow-y: auto;
}

.summary {
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1rem;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.link-button {
  width: 100%;
}

.favicon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  object-fit: contain;
}
</style>
