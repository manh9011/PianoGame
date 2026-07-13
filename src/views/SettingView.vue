<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import SettingsSidebar from '../components/settings/ui/SettingsSidebar.vue'

const router = useRouter()
</script>

<template>
  <main class="settings-view">
    <header class="settings-topbar">
      <button class="settings-back" type="button" @click="router.push('/')">
        <i class="fa-solid fa-chevron-left" aria-hidden="true" />
        Back
      </button>
      <h1>Settings</h1>
      <span class="settings-brand">Synthesia Style</span>
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
  min-height: 100vh;
  display: grid;
  grid-template-rows: 2.75rem minmax(0, 1fr);
  background: #4a4a4a;
  color: #f0f0f0;
  overflow: hidden;
}

.settings-topbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 0 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(#323232, #262626);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.34rem;
  background: linear-gradient(#444444, #303030);
  color: rgba(255, 255, 255, 0.9);
}

.settings-back:hover {
  background: linear-gradient(#515151, #393939);
}

.settings-brand {
  color: rgba(255, 255, 255, 0.42);
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
  background: #4a4a4a;
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
  color: rgba(255, 255, 255, 0.92);
  font-size: 1.12rem;
  font-weight: 600;
}

.settings-content :deep(.settings-page-title p) {
  margin: 0.18rem 0 0;
  color: rgba(255, 255, 255, 0.48);
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
