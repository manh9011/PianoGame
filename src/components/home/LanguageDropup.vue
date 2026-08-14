<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { localeOptions, type SupportedLocale } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
const { t } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

const selectedLocale = computed(() => localeOptions.find(option => option.code === settings.locale) ?? localeOptions[1])

function getFlagUrl(flagCode: string) {
  return `/flags/${flagCode}.png`
}

function toggle() {
  open.value = !open.value
}

function selectLocale(locale: SupportedLocale) {
  settings.setLocale(locale)
  open.value = false
}

function closeOnOutside(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', closeOnOutside)
  document.addEventListener('keydown', closeOnEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutside)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <div ref="root" class="language-dropup">
    <button
      class="language-trigger"
      type="button"
      :aria-label="t('language.open')"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <img class="language-flag" aria-hidden="true" :src="getFlagUrl(selectedLocale.flagCode)" alt="" />
      <span>{{ selectedLocale.nativeName }}</span>
      <i class="fa-solid fa-chevron-up" aria-hidden="true" />
    </button>

    <div v-if="open" class="language-menu" role="menu">
      <button
        v-for="option in localeOptions"
        :key="option.code"
        class="language-option"
        :class="{ active: option.code === settings.locale }"
        type="button"
        role="menuitemradio"
        :aria-checked="option.code === settings.locale"
        :dir="option.dir"
        @click="selectLocale(option.code)"
      >
        <img class="language-flag" aria-hidden="true" :src="getFlagUrl(option.flagCode)" alt="" />
        <span class="language-name">{{ option.nativeName }}</span>
        <span class="language-english">{{ option.englishName }}</span>
        <i v-if="option.code === settings.locale" class="fa-solid fa-check" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.language-dropup {
  position: relative;
  display: inline-flex;
}

.language-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.34rem 0.56rem;
  border: 1px solid var(--color-border-default);
  border-radius: 0.45rem;
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  font-size: 0.85rem;
}

.language-trigger:hover {
  background: var(--color-bg-subtle);
}

.language-trigger i {
  color: var(--color-text-muted);
  font-size: 0.66rem;
}

.language-menu {
  position: absolute;
  inset-inline-start: 0;
  bottom: calc(100% + 0.45rem);
  z-index: 30;
  width: 13rem;
  max-height: 18rem;
  max-height: min(18rem, 65vh);
  max-height: min(18rem, 65dvh);
  overflow: auto;
  padding: 0.28rem;
  border: 1px solid var(--color-border-default);
  border-radius: 0.56rem;
  background: var(--color-bg-elevated-2);
  box-shadow: 0 0.7rem 1.5rem rgba(0, 0, 0, 0.38);
}

.language-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.14rem 0.5rem;
  width: 100%;
  padding: 0.44rem 0.52rem;
  border: 0;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--color-text-primary);
  text-align: start;
}

.language-option:hover,
.language-option.active {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}

.language-flag {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: auto;
  border-radius: 2px;
  object-fit: contain;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.language-option .language-flag {
  grid-row: 1 / span 2;
  grid-column: 1;
}

.language-name,
.language-english {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.language-name {
  font-weight: 600;
}

.language-english {
  grid-column: 2;
  color: var(--color-text-muted);
  font-size: 0.72rem;
}

.language-option i {
  grid-row: 1 / span 2;
  grid-column: 3;
  color: #a3e635;
  font-size: 0.78rem;
}
</style>


