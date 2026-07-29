<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type HintDefinition = {
  key: string
  anchor: string
  labelKey: string
  kbd?: string
  group: 'main' | 'right'
  row: number
}

type HintPlacement = {
  left: number
  top: number
  line: number
}

const props = defineProps<{
  show: boolean
}>()

const { t } = useI18n()

const topHints: HintDefinition[] = [
  { key: 'play', anchor: 'play-pause', labelKey: 'play.playPause', kbd: 'Space', group: 'main', row: 0 },
  { key: 'previous-bookmark', anchor: 'previous-bookmark', labelKey: 'play.previousBookmark', kbd: 'Comma', group: 'main', row: 1 },
  { key: 'next-bookmark', anchor: 'next-bookmark', labelKey: 'play.nextBookmark', kbd: 'Period', group: 'main', row: 2 },
  { key: 'speed-down', anchor: 'speed-down', labelKey: 'play.speedDown', kbd: 'Down', group: 'main', row: 3 },
  { key: 'speed-up', anchor: 'speed-up', labelKey: 'play.speedUp', kbd: 'Up', group: 'main', row: 3 },
  { key: 'settings', anchor: 'settings', labelKey: 'common.settings', group: 'right', row: 0 },
  { key: 'metronome', anchor: 'metronome', labelKey: 'play.metronome', group: 'right', row: 1 },
  { key: 'track-config', anchor: 'track-config', labelKey: 'play.trackConfig', group: 'right', row: 2 },
  { key: 'keyboard-range', anchor: 'keyboard-range', labelKey: 'play.keyboardRange', group: 'right', row: 3 },
  { key: 'finger-hints', anchor: 'finger-hints', labelKey: 'play.fingerHints', kbd: 'H', group: 'right', row: 4 },
  { key: 'bookmarks', anchor: 'bookmarks', labelKey: 'play.bookmarks', kbd: 'B', group: 'right', row: 5 },
  { key: 'note-labels', anchor: 'note-labels', labelKey: 'play.noteLabels', group: 'right', row: 6 },
  { key: 'looping', anchor: 'looping', labelKey: 'play.loop', kbd: 'V', group: 'right', row: 7 },
  { key: 'fullscreen', anchor: 'fullscreen', labelKey: 'play.fullscreen', kbd: 'F11', group: 'right', row: 8 },
]

const placements = ref<Record<string, HintPlacement>>({})
const visibleTopHints = computed(() => topHints
  .map(hint => ({ ...hint, placement: placements.value[hint.key] }))
  .filter((hint): hint is HintDefinition & { placement: HintPlacement } => Boolean(hint.placement))
)

let animationFrameId = 0

function updatePlacements() {
  const nextPlacements: Record<string, HintPlacement> = {}
  const viewportHeight = window.innerHeight

  for (const hint of topHints) {
    const anchor = document.querySelector<HTMLElement>(`[data-help-anchor="${hint.anchor}"]`)
    if (!anchor) continue

    const rect = anchor.getBoundingClientRect()
    const anchorX = rect.left + rect.width / 2
    const anchorY = rect.top + rect.height / 2
    const groupOffset = hint.group === 'right' ? 176 : 24
    const preferredTop = rect.bottom + groupOffset + hint.row * 32
    const maxTop = Math.max(rect.bottom + 18, viewportHeight - 118)
    const top = Math.min(preferredTop, maxTop)
    const line = Math.max(12, top - anchorY - 6)

    nextPlacements[hint.key] = {
      left: Math.round(anchorX),
      top: Math.round(top),
      line: Math.round(line),
    }
  }

  placements.value = nextPlacements
}

function scheduleUpdate() {
  if (!props.show) return
  if (animationFrameId) window.cancelAnimationFrame(animationFrameId)
  animationFrameId = window.requestAnimationFrame(() => {
    animationFrameId = 0
    updatePlacements()
  })
}

function addViewportListeners() {
  window.addEventListener('resize', scheduleUpdate)
  window.visualViewport?.addEventListener('resize', scheduleUpdate)
  window.visualViewport?.addEventListener('scroll', scheduleUpdate)
}

function removeViewportListeners() {
  window.removeEventListener('resize', scheduleUpdate)
  window.visualViewport?.removeEventListener('resize', scheduleUpdate)
  window.visualViewport?.removeEventListener('scroll', scheduleUpdate)
}

watch(() => props.show, async show => {
  if (!show) {
    placements.value = {}
    removeViewportListeners()
    return
  }

  addViewportListeners()
  await nextTick()
  scheduleUpdate()
}, { immediate: true })

onBeforeUnmount(() => {
  removeViewportListeners()
  if (animationFrameId) window.cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="help-fade">
      <section v-if="show" class="help-overlay" :aria-label="t('help.aria')">
        <div class="top-hints" aria-hidden="true">
          <div
            v-for="hint in visibleTopHints"
            :key="hint.key"
            class="hint"
            :style="{
              left: `${hint.placement.left}px`,
              top: `${hint.placement.top}px`,
              '--line': `${hint.placement.line}px`,
            }"
          >
            <span>{{ t(hint.labelKey) }}</span>
            <kbd v-if="hint.kbd">{{ hint.kbd }}</kbd>
          </div>
        </div>

        <aside class="shortcut-card">
          <div class="shortcut-row">
            <span>{{ t('help.stepBackward') }}:</span>
            <kbd>Left</kbd>
          </div>
          <div class="shortcut-row">
            <span>{{ t('help.stepForward') }}:</span>
            <kbd>Right</kbd>
          </div>
          <div class="shortcut-row">
            <span>{{ t('help.stretchFallingNotes') }}:</span>
            <kbd>Page Up</kbd>
          </div>
          <div class="shortcut-row">
            <span>{{ t('help.compressFallingNotes') }}:</span>
            <kbd>Page Down</kbd>
          </div>
          <div class="shortcut-row">
            <span>{{ t('help.shiftInputOctaveUp') }}:</span>
            <kbd>X</kbd>
          </div>
          <div class="shortcut-row">
            <span>{{ t('help.shiftInputOctaveDown') }}:</span>
            <kbd>Z</kbd>
          </div>
        </aside>

        <p class="help-message">{{ t('help.keyboardMessage') }}</p>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.help-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  pointer-events: none;
  background: linear-gradient(
    rgba(0, 0, 0, 0.06),
    rgba(0, 0, 0, 0.12)
  );
  color: var(--color-text-primary);
  font-size: 0.85rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}

.top-hints {
  position: absolute;
  inset: 0;
}

.hint {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
  transform: translateX(-100%);
}

.hint::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 6px);
  left: 100%;
  width: 2px;
  height: var(--line);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.45);
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.45rem;
  min-height: 1.35rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  font: 600 0.75rem/1 Inter, Segoe UI, system-ui, sans-serif;
  text-shadow: none;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.3);
}

.shortcut-card {
  position: absolute;
  left: 0.75rem;
  bottom: 3.8rem;
  display: grid;
  gap: 0.55rem;
  min-width: 23rem;
  padding: 0.85rem 0.75rem;
  border-radius: 4px;
  background: var(--color-bg-tooltip);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 1rem;
}

.help-message {
  position: absolute;
  left: 0.75rem;
  bottom: 1rem;
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 4px;
  background: var(--color-bg-tooltip);
  font-size: 0.98rem;
}

.help-fade-enter-active,
.help-fade-leave-active {
  transition: opacity 0.16s ease;
}

.help-fade-enter-from,
.help-fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .top-hints {
    display: none;
  }

  .shortcut-card {
    right: 0.75rem;
    bottom: 4.2rem;
    min-width: 0;
  }

  .help-message {
    right: 0.75rem;
  }
}
</style>

