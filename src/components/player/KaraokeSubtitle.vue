<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../../stores/playerStore'
import { findActiveKaraokeLineIndex } from '../../modules/game/karaokeLyrics'

/* Fixed strip layout: 56px per line, 3 visible rows, the active (gold) line
 * anchored to the viewport center. The strip translates discretely when the
 * active line finishes; while a line is being sung only the word fill sweeps. */
const LINE_H = 56
const VISIBLE_ROWS = 3
const VIEWPORT_H = LINE_H * VISIBLE_ROWS

const player = usePlayerStore()

const lines = computed(() => player.karaokeLines)
const currentUs = computed(() => player.session?.currentUs ?? 0)
const activeIndex = computed(() => findActiveKaraokeLineIndex(lines.value, currentUs.value))

function wordProgress(startUs: number, endUs: number): number {
  const t = currentUs.value
  if (t <= startUs) return 0
  if (t >= endUs) return 100
  return ((t - startUs) / (endUs - startUs)) * 100
}

const rows = computed(() => {
  const focus = activeIndex.value
  return lines.value.map((line, index) => ({
    id: line.id,
    isCurrent: index === focus,
    isPast: index < focus,
    isFuture: index > focus,
    words: line.words.map(word => ({
      text: word.text,
      progress: index === focus ? wordProgress(word.startUs, word.endUs) : 0,
    })),
  }))
})

const translateYPx = computed(() => {
  const index = activeIndex.value
  if (index < 0) return 0
  const focusYPx = VIEWPORT_H / 2
  const lineCenterInStripYPx = (index + 1) * LINE_H + LINE_H / 2
  return lineCenterInStripYPx - focusYPx
})
</script>

<template>
  <div class="karaoke-sub">
    <div class="karaoke-scroll" :style="{ height: `${VIEWPORT_H}px` }">
      <div class="strip" :style="{ transform: `translateY(${-translateYPx}px)` }">
        <div class="karaoke-box spacer" aria-hidden="true" />
        <div
          v-for="row in rows"
          :key="row.id"
          class="karaoke-box"
          :class="{ 'is-current': row.isCurrent, 'is-past': row.isPast, 'is-future': row.isFuture }"
        >
          <span v-for="(word, index) in row.words" :key="index" class="word">
            <span class="base">{{ word.text }}</span>
            <span
              v-if="row.isCurrent"
              class="fill"
              :style="{ backgroundImage: `linear-gradient(90deg, var(--color-accent-amber) ${word.progress}%, transparent ${word.progress}%)` }"
            >{{ word.text }}</span>
            <span v-if="index < row.words.length - 1">&nbsp;</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.karaoke-sub {
  position: absolute;
  bottom: 6%;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 20;
  pointer-events: none;
}

.karaoke-scroll {
  overflow: hidden;
  position: relative;
  width: 100%;
  max-width: 90vw;
}

.strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.karaoke-box {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  width: fit-content;
  max-width: 90vw;
  padding: 0 22px;
  font-weight: 700;
  text-align: center;
  font-size: 26px;
  color: var(--color-text-primary);
  opacity: 0.55;
  filter: brightness(0.85);
  transform: scale(0.92);
  transition:
    opacity 0.45s ease,
    filter 0.45s ease,
    transform 0.45s ease;
}

.karaoke-box.is-current {
  opacity: 1;
  filter: brightness(1.12);
  transform: scale(1.5);
}

.karaoke-box.is-past {
  opacity: 0;
  filter: brightness(0.6);
  transform: scale(0.92);
}

.karaoke-box.spacer {
  visibility: hidden;
  pointer-events: none;
}

.word {
  position: relative;
  display: inline-block;
  white-space: pre;
  text-shadow:
    -1px -1px 0 rgba(0, 0, 0, 0.9),
     1px -1px 0 rgba(0, 0, 0, 0.9),
    -1px  1px 0 rgba(0, 0, 0, 0.9),
     1px  1px 0 rgba(0, 0, 0, 0.9),
    -2px  0   0 rgba(0, 0, 0, 0.9),
     2px  0   0 rgba(0, 0, 0, 0.9),
     0   -2px 0 rgba(0, 0, 0, 0.9),
     0    2px 0 rgba(0, 0, 0, 0.9);
}

.base {
  color: var(--color-text-primary);
}

.fill {
  position: absolute;
  left: 0;
  top: 0;
  display: inline-block;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  text-shadow: none;
}
</style>
