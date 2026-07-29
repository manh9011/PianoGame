<script setup lang="ts">
interface Props {
  show: boolean
  width?: string
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top?: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right' | 'top'
  closeOnClickOutside?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: '320px',
  popupStyle: () => ({ top: '0px', left: '0px' }),
  arrowStyle: () => ({ top: '0px', right: '-7px' }),
  arrowPlacement: 'right',
  closeOnClickOutside: true
})

const emit = defineEmits<{
  close: []
}>()

function handleClickOutside(event: MouseEvent) {
  if (!props.closeOnClickOutside) return
  const target = event.target as HTMLElement
  if (target.closest('.popover-container')) return
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="popover">
      <div v-if="show" class="popover-wrapper" @click="handleClickOutside">
        <div
          class="popover-container"
          :style="{ width: width, ...popupStyle }"
          @click.stop
        >
          <div class="popover-content">
            <slot></slot>
          </div>
          <div
            class="popover-arrow"
            :class="arrowPlacement"
            :style="arrowStyle"
          ></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.popover-wrapper {
  position: fixed;
  inset: 0;
  z-index: 100;
}

.popover-container {
  position: absolute;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-lg);
  overflow: visible;
  pointer-events: auto;
}

.popover-content {
  padding: 1rem;
  overflow: auto;
  max-height: min(90dvh, 600px);
  border-radius: 12px;
}

.popover-arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  transform: rotate(45deg);
  pointer-events: none;
}

.popover-arrow.right {
  /* Mũi tên ở bên phải popup, chỉ sang phải về button */
  border-left: none;
  border-bottom: none;
}

.popover-arrow.left {
  /* Mũi tên ở bên trái popup, chỉ sang trái về button */
  border-right: none;
  border-bottom: none;
}

.popover-arrow.top {
  /* Mũi tên ở phía trên popup, chỉ lên button */
  border-right: none;
  border-bottom: none;
}

.popover-enter-active,
.popover-leave-active {
  transition: opacity 0.2s ease;
}

.popover-enter-active .popover-container,
.popover-leave-active .popover-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
}

.popover-enter-from .popover-container,
.popover-leave-to .popover-container {
  transform: scale(0.95);
  opacity: 0;
}
</style>

