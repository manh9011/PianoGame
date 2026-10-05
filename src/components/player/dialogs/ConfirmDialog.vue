<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirmStore } from '../../../stores/confirmStore'
import BaseDialog from '../../ui/BaseDialog.vue'

const { t } = useI18n()
const confirmStore = useConfirmStore()
const cancelButtonRef = ref<HTMLButtonElement>()

const cancelLabel = computed(() => confirmStore.cancelLabel || t('common.cancel'))
const confirmLabel = computed(() => confirmStore.confirmLabel || t('common.continue'))
const confirmButtonClass = computed(() => [
  'confirm-dialog__button',
  confirmStore.tone === 'danger' ? 'danger' : 'primary',
])

watch(
  () => confirmStore.visible,
  async visible => {
    if (!visible) return
    await nextTick()
    cancelButtonRef.value?.focus()
  },
)
</script>

<template>
  <BaseDialog
    :show="confirmStore.visible"
    title=""
    width="800px"
    :show-close-button="false"
    aria-labelledby=""
    aria-describedby="confirm-dialog-message"
    @close="confirmStore.cancel()"
  >
    <form class="confirm-dialog" @submit.prevent="confirmStore.confirm()" @keydown.esc.prevent="confirmStore.cancel()">
      <div class="confirm-dialog__topbar">
        <button ref="cancelButtonRef" type="button" class="confirm-dialog__cancel" @click="confirmStore.cancel()">
          {{ cancelLabel }}
        </button>
        <h3 v-if="confirmStore.title" class="confirm-dialog__title">{{ confirmStore.title }}</h3>
      </div>
      <p id="confirm-dialog-message" class="confirm-dialog__message">{{ confirmStore.message }}</p>
      <button type="submit" :class="confirmButtonClass">
        {{ confirmLabel }}
      </button>
    </form>
  </BaseDialog>
</template>

<style scoped>
.confirm-dialog {
  display: grid;
  gap: 0.7rem;
  padding: 0.45rem;
  margin: -1.25rem;
  background: var(--color-bg-header);
}

.confirm-dialog__topbar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  position: relative;
}

.confirm-dialog__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text-primary);
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.confirm-dialog__cancel {
  min-height: 34px;
  padding: 0.3rem 0.65rem;
  border-radius: 4px;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 0.95rem;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset;
  transition: filter 0.16s ease, transform 0.16s ease;
}

.confirm-dialog__message {
  margin: 0;
  min-height: 9.75rem;
  display: grid;
  place-items: center;
  padding: 1.15rem 1.5rem;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  font-size: 1.05rem;
  line-height: 1.65;
  text-align: center;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.confirm-dialog__button {
  width: 100%;
  min-height: 44px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 1.35rem;
  transition: filter 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
}

.confirm-dialog__cancel:hover,
.confirm-dialog__cancel:focus-visible,
.confirm-dialog__button:hover,
.confirm-dialog__button:focus-visible {
  filter: brightness(1.12);
}

.confirm-dialog__cancel:active,
.confirm-dialog__button:active {
  transform: translateY(1px);
}

.confirm-dialog__cancel:focus-visible,
.confirm-dialog__button:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.88);
  outline-offset: 2px;
}

.confirm-dialog__button.primary {
  background: var(--color-accent-blue);
  color: #fff;
}

.confirm-dialog__button.danger {
  background: var(--color-btn-danger-bg);
  color: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
}

@media (max-width: 720px) {
  .confirm-dialog__button {
    font-size: 1.1rem;
  }
}
</style>

