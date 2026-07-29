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
  border-inline-end: 1px solid var(--color-border-subtle);
  background: var(--color-bg-secondary);
}

.settings-sidebar-item {
  display: grid;
  grid-template-columns: 1.2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.42rem;
  min-height: 2.1rem;
  padding: 0.5rem 0.38rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  text-decoration: none;
}

.settings-sidebar-item:hover {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}

.settings-sidebar-item.router-link-active {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
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
    border-bottom: 1px solid var(--color-border-subtle);
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

