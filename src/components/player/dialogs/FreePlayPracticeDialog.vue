<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '../../ui/BaseDialog.vue'
import BaseInput from '../../ui/BaseInput.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [name: string]
}>()

const { t } = useI18n()
const inputRef = ref<InstanceType<typeof BaseInput> | null>(null)
const songName = ref('')

watch(
  () => props.show,
  async (show) => {
    if (show) {
      songName.value = ''
      await nextTick()
      const inputEl = inputRef.value?.$el?.querySelector('input')
      if (inputEl) inputEl.focus()
    }
  }
)

function submit() {
  if (!songName.value.trim()) return
  emit('confirm', songName.value.trim())
  emit('close')
}
</script>

<template>
  <BaseDialog
    :show="show"
    title=""
    width="600px"
    :show-close-button="false"
    @close="emit('close')"
  >
    <form class="practice-dialog" @submit.prevent="submit" @keydown.esc.prevent="emit('close')">
      <div class="practice-dialog__topbar">
        <button type="button" class="practice-dialog__btn cancel-btn" @click="emit('close')">
          {{ t('common.cancel') }}
        </button>
        <h3 class="practice-dialog__title">{{ t('freePlay.practiceDialogTitle') }}</h3>
        <button type="submit" class="practice-dialog__btn save-btn" :disabled="!songName.trim()">
          {{ t('common.save') }}
        </button>
      </div>
      <div class="practice-dialog__content">
        <BaseInput
          ref="inputRef"
          v-model="songName"
          :placeholder="t('freePlay.practiceDialogPlaceholder')"
          class="practice-input"
        />
      </div>
    </form>
  </BaseDialog>
</template>

<style scoped>
.practice-dialog {
  display: grid;
  padding: 0.45rem;
  margin: -1.25rem;
  background: var(--color-bg-header);
}

.practice-dialog__topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  padding-bottom: 0.75rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.practice-dialog__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 500;
  color: var(--color-text-primary);
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  white-space: nowrap;
}

.practice-dialog__btn {
  min-height: 34px;
  padding: 0.3rem 0.85rem;
  border-radius: 4px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: filter 0.16s ease, transform 0.16s ease;
}

.practice-dialog__btn:hover:not(:disabled) {
  filter: brightness(1.12);
}
.practice-dialog__btn:active:not(:disabled) {
  transform: translateY(1px);
}
.practice-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset;
}

.save-btn {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--color-accent-blue);
  color: #fff;
}

.practice-dialog__content {
  padding: 0 0.25rem 0.25rem 0.25rem;
}

:deep(.practice-input .base-input-field) {
  font-size: 1.05rem;
  padding: 0.7rem;
}
</style>
