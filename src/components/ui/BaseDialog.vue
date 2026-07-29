<script setup lang="ts">
interface Props {
  show: boolean
  title?: string
  width?: string
  showCloseButton?: boolean
  closeOnOverlay?: boolean
  ariaLabelledby?: string
  ariaDescribedby?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '480px',
  showCloseButton: true,
  closeOnOverlay: true,
  ariaLabelledby: '',
  ariaDescribedby: '',
})

const emit = defineEmits<{
  close: []
}>()

function handleOverlayClick(event: MouseEvent) {
  if (props.closeOnOverlay && event.target === event.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Transition name="dialog">
    <div v-if="show" class="dialog-overlay" @click="handleOverlayClick">
      <div
        class="dialog-container"
        :style="{ maxWidth: width }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="ariaLabelledby || undefined"
        :aria-describedby="ariaDescribedby || undefined"
      >
        <header v-if="title" class="dialog-header">
          <h3 :id="ariaLabelledby || undefined">{{ title }}</h3>
          <button v-if="showCloseButton" class="close-button" @click="emit('close')">✕</button>
        </header>
        <div class="dialog-content">
          <slot></slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  background: var(--color-bg-overlay);
  backdrop-filter: blur(4px);
}

.dialog-container {
  width: min(94vw, 100%);
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-default);
  background: var(--color-bg-subtle);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.1rem;
  font-weight: 600;
}

.close-button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}

.dialog-content {
  flex: 1;
  overflow: auto;
  padding: 1.25rem;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-container,
.dialog-leave-to .dialog-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>
