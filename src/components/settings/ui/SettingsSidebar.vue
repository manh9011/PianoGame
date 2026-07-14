<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { settingsNavigation } from '../../../modules/settings/settingsNavigation'

const { t } = useI18n()
</script>

<template>
  <nav class="settings-sidebar" :aria-label="t('settings.navigation')">
    <RouterLink
      v-for="item in settingsNavigation"
      :key="item.routeName"
      class="settings-sidebar-item"
      :to="item.to"
    >
      <i :class="item.icon" aria-hidden="true" />
      <span>{{ t(item.labelKey) }}</span>
      <i class="fa-solid fa-chevron-right chevron" aria-hidden="true" />
    </RouterLink>
  </nav>
</template>

<style scoped>
.settings-sidebar {
  width: 10.15rem;
  min-width: 10.15rem;
  border-inline-end: 1px solid rgba(255, 255, 255, 0.08);
  background: #303030;
}

.settings-sidebar-item {
  display: grid;
  grid-template-columns: 1.2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.42rem;
  min-height: 2.1rem;
  padding: 0.5rem 0.38rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.8rem;
  text-decoration: none;
}

.settings-sidebar-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}

.settings-sidebar-item.router-link-active {
  background: #9d9d9d;
  color: #ffffff;
}

.settings-sidebar-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  color: rgba(206, 216, 42, 0.85);
  font-size: 0.68rem;
}

@media (max-width: 820px) {
  .settings-sidebar {
    width: 100%;
    min-width: 0;
    display: flex;
    overflow-x: auto;
    border-inline-end: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .settings-sidebar-item {
    min-width: max-content;
    grid-template-columns: 1rem auto;
    padding-right: 0.8rem;
  }

  .settings-sidebar-item .chevron {
    display: none;
  }
}
</style>
