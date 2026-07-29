<template>
  <Transition name="toast">
    <div
      v-if="toastStore.visible"
      class="toast"
      :class="`toast--${toastStore.type}`"
      @click="handleClick"
    >
      <div class="toast__content">
        <div class="toast__icon">
          <i v-if="toastStore.type === 'loading'" class="fas fa-spinner fa-spin"></i>
          <i v-else-if="toastStore.type === 'success'" class="fas fa-check-circle"></i>
          <i v-else-if="toastStore.type === 'error'" class="fas fa-exclamation-circle"></i>
          <i v-else class="fas fa-info-circle"></i>
        </div>
        <div class="toast__message">{{ toastStore.message }}</div>
        <button
          v-if="toastStore.type !== 'loading'"
          class="toast__close"
          @click.stop="toastStore.hide()"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div
        v-if="toastStore.type === 'loading'"
        class="toast__progress"
        :style="{ width: `${toastStore.progress}%` }"
      ></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useToastStore } from '../stores/toastStore'

const toastStore = useToastStore()

function handleClick() {
  if (toastStore.type !== 'loading') {
    toastStore.hide()
  }
}
</script>

<style scoped>
.toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 400px;
  max-width: 500px;
  background: var(--color-bg-tooltip);
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 9999;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.toast__content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.toast__icon {
  font-size: 20px;
  flex-shrink: 0;
}

.toast__message {
  flex: 1;
  font-size: 15px;
  line-height: 1.5;
  color: var(--color-text-primary);
  font-weight: 500;
}

.toast__close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.toast__close:hover {
  opacity: 1;
}

.toast__progress {
  height: 4px;
  background: currentColor;
  transition: width 0.3s ease;
  box-shadow: 0 0 8px currentColor;
}

.toast--loading {
  color: #22c55e;
}

.toast--loading .toast__icon {
  color: #22c55e;
}

.toast--loading .toast__progress {
  background: #22c55e;
}

.toast--success {
  color: #10b981;
  border-color: #10b981;
}

.toast--success .toast__icon {
  color: #10b981;
}

.toast--error {
  color: #ef4444;
  border-color: #ef4444;
}

.toast--error .toast__icon {
  color: #ef4444;
}

.toast--info {
  color: #6366f1;
}

.toast--info .toast__icon {
  color: #6366f1;
}

.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.7);
}
</style>


