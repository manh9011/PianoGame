<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterView, useRouter } from 'vue-router'
import SettingsSidebar from '../components/settings/ui/SettingsSidebar.vue'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="settings-view">
    <header class="settings-topbar">
      <button class="settings-back" type="button" @click="router.push('/')">
        <i class="fa-solid fa-chevron-left" aria-hidden="true" />
        {{ t('common.back') }}
      </button>
      <h1>{{ t('settings.title') }}</h1>
    </header>

    <div class="settings-frame">
      <SettingsSidebar />
      <section class="settings-content">
        <RouterView />
      </section>
    </div>
  </main>
</template>

<style scoped>
.settings-view {
  height: 100dvh;
  min-height: 0;
  display: grid;
  grid-template-rows: 2.75rem minmax(0, 1fr);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  overflow: hidden;
}

.settings-topbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 0 0.85rem;
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-bg-header);
  box-shadow: var(--shadow-sm);
}

.settings-topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 1.08rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.settings-back {
  display: inline-flex;
  align-items: center;
  gap: 0.36rem;
  min-height: 1.9rem;
  padding: 0.34rem 0.68rem;
  border: 1px solid var(--color-border-default);
  border-radius: 0.34rem;
  background: var(--color-btn-secondary-bg);
  color: var(--color-btn-secondary-text);
}

.settings-back:hover {
  background: var(--color-btn-secondary-hover);
}

.settings-brand {
  color: var(--color-text-muted);
  font-size: 0.76rem;
}

.settings-frame {
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.settings-content {
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 0.82rem 1rem 1.4rem;
  background: var(--color-bg-primary);
}

.settings-content :deep(.settings-page) {
  width: min(100%, 72rem);
  margin: 0 auto;
  display: grid;
  gap: 0.9rem;
}

.settings-content :deep(.settings-page-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 0.1rem;
  padding: 0 0.2rem;
}

.settings-content :deep(.settings-page-title h2) {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.12rem;
  font-weight: 600;
}

.settings-content :deep(.settings-page-title p) {
  margin: 0.18rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

@media (max-width: 820px) {
  .settings-view {
    grid-template-rows: auto minmax(0, 1fr);
  }

  .settings-topbar {
    min-height: 2.75rem;
  }

  .settings-brand {
    display: none;
  }

  .settings-frame {
    flex-direction: column;
  }
}
</style>
