<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TrackRole } from '../../../modules/game/trackProperties'

const props = defineProps<{
  show: boolean
  currentRole?: TrackRole
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right'
}>()

const emit = defineEmits<{
  select: [role: TrackRole]
  close: []
}>()

const { t } = useI18n()

const options: Array<{ role: TrackRole | 'custom'; labelKey: string; icon: string; disabled?: boolean; flipped?: boolean }> = [
  { role: 'left', labelKey: 'trackSettings.left', icon: 'fas fa-hand-paper', flipped: true },
  { role: 'right', labelKey: 'trackSettings.right', icon: 'fas fa-hand-paper' },
  { role: 'background', labelKey: 'trackSettings.background', icon: 'fas fa-cog' },
  { role: 'custom', labelKey: 'trackSettings.custom', icon: 'fas fa-sliders-h', disabled: true },
]

function choose(role: TrackRole | 'custom') {
  if (role === 'custom') return
  emit('select', role)
  emit('close')
}

function close() {
  emit('close')
}
</script>

<template>
  <div v-if="show" class="role-overlay" @click="close">
    <div class="role-dialog" :style="popupStyle" @click.stop>
      <div class="dialog-arrow" :class="arrowPlacement" :style="arrowStyle"></div>
      <button
        v-for="option in options"
        :key="option.role"
        class="role-item"
        :class="{ selected: option.role === currentRole, disabled: option.disabled }"
        :disabled="option.disabled"
        @click="choose(option.role)"
      >
        <span class="role-icon" :class="{ flipped: option.flipped }"><i :class="option.icon"></i></span>
        <span class="role-label">{{ t(option.labelKey) }}</span>
        <i v-if="option.role === currentRole" class="fas fa-check role-check"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.role-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: transparent;
}

.role-dialog {
  position: fixed;
  z-index: 1051;
  width: 290px;
  padding: 10px;
  background: #242424;
  border: 8px solid #171717;
  border-radius: 5px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.45);
}

.dialog-arrow {
  position: absolute;
  width: 18px;
  height: 18px;
  background: #171717;
  transform: rotate(45deg);
  z-index: -1;
}

.dialog-arrow.right { right: -9px; }
.dialog-arrow.left { left: -9px; }

.role-item {
  width: 100%;
  min-height: 44px;
  display: grid;
  grid-template-columns: 42px 1fr 22px;
  align-items: center;
  gap: 10px;
  border: 1px solid #1a1a1a;
  border-bottom: 0;
  background: #3a3a3a;
  color: #f1f1f1;
  padding: 5px 10px;
  cursor: pointer;
  text-align: start;
  font-size: 0.95rem;
  border-radius: 0;
}

.role-item:first-of-type { border-radius: 8px 8px 0 0; }
.role-item:last-of-type { border-bottom: 1px solid #1a1a1a; border-radius: 0 0 8px 8px; }
.role-item:hover:not(.disabled),
.role-item.selected { background: #454545; }
.role-item.disabled { color: #9a9a9a; cursor: not-allowed; opacity: 0.7; }
.role-icon { display: grid; place-items: center; color: #d9d9d9; font-size: 1.35rem; }
.role-icon.flipped { transform: scaleX(-1); }
.role-check { color: #d3d931; }
</style>
