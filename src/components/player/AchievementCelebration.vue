<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MidiAssetPlayer } from '../../modules/audio/midiAssetPlayer'
import type { AchievementCelebration } from '../../stores/profileStore'
import { useSettingsStore } from '../../stores/settingsStore'
import achievementUrl from '../../../achievement.mid?url'

const props = defineProps<{ celebration: AchievementCelebration }>()
const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const settings = useSettingsStore()

const displayScore = ref(props.celebration.from)
let frameId: number | null = null
let timeoutId: number | null = null
let startedAt = 0
const midiPlayer = new MidiAssetPlayer()
const MIN_VISIBLE_MS = 2400

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function confettiStyle(i: number) {
  const index = i - 1
  const column = index % 14
  const row = Math.floor(index / 14)
  const chaos = (i * 37) % 17
  const drift = column % 2 === 0 ? 1 : -1
  return {
    '--x': `${column * 6.8 + 3 + (chaos % 4)}%`,
    '--y': `${row * 0.22 + (chaos % 5) * 0.08}rem`,
    '--hue': `${(i * 31 + row * 19) % 360}deg`,
    '--delay': `${(index % 18) * 15 + row * 9}ms`,
    '--dx': `${11 + (index % 8) * 3.5 + chaos * 0.45}vw`,
    '--dy': `-${48 + (index % 13) * 3.8 + row * 2.2}vh`,
    '--mid-x': `${drift * (5 + chaos * 0.35)}vw`,
    '--mid-y': `-${24 + (index % 9) * 2.4}vh`,
    '--scale': `${0.82 + (chaos % 7) * 0.08}`,
    '--scale-pop': `${(0.82 + (chaos % 7) * 0.08) * 1.18}`,
    '--scale-end': `${(0.82 + (chaos % 7) * 0.08) * 0.82}`,
    '--rot-start': `${i * 23}deg`,
    '--rot-mid': `${i * 97}deg`,
    '--rot-late': `${i * 121}deg`,
    '--rot-end': `${i * 173}deg`,
  }
}

function animate(now: number) {
  if (!startedAt) startedAt = now
  const progress = Math.min(1, (now - startedAt) / 1400)
  displayScore.value = Math.round((props.celebration.from + (props.celebration.to - props.celebration.from) * easeOutCubic(progress)) * 10) / 10
  if (progress < 1) frameId = requestAnimationFrame(animate)
}

async function playAchievementSound() {
  try {
    const playback = await midiPlayer.play({ url: achievementUrl, midiOutputId: settings.midiOutputId })
    const visibleMs = Math.max(MIN_VISIBLE_MS, playback.durationMs + 250)
    if (timeoutId !== null) window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => emit('done'), visibleMs)
  } catch (error) {
    console.warn('Không phát được achievement.mid.', error)
  }
}

onMounted(() => {
  frameId = requestAnimationFrame(animate)
  timeoutId = window.setTimeout(() => emit('done'), MIN_VISIBLE_MS)
  void playAchievementSound()
})

onBeforeUnmount(() => {
  if (frameId !== null) cancelAnimationFrame(frameId)
  if (timeoutId !== null) window.clearTimeout(timeoutId)
  midiPlayer.stop()
})
</script>

<template>
  <div class="achievement-celebration" aria-live="polite">
    <div class="confetti left">
      <span v-for="i in 120" :key="`l-${i}`" :style="confettiStyle(i)" />
    </div>
    <div class="confetti right">
      <span v-for="i in 120" :key="`r-${i}`" :style="confettiStyle(i)" />
    </div>
    <div class="achievement-card">
      <span class="label">{{ t('achievement.increased') }}</span>
      <strong>{{ displayScore }}</strong>
      <small>{{ props.celebration.from }} → {{ props.celebration.to }}</small>
    </div>
  </div>
</template>

<style scoped>
.achievement-celebration {
  position: fixed;
  inset: 0;
  z-index: 1100;
  pointer-events: none;
  overflow: hidden;
}

.achievement-card {
  position: absolute;
  top: 14%;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  gap: 0.1rem;
  min-width: 12rem;
  padding: 0.8rem 1.2rem;
  border: 1px solid rgba(254, 240, 138, 0.75);
  border-radius: 16px;
  background: rgba(24, 24, 27, 0.88);
  box-shadow: 0 0 28px rgba(250, 204, 21, 0.55), 0 12px 36px rgba(0, 0, 0, 0.38);
  animation: card-glow 2.2s ease-out both;
}

.label {
  color: #fde68a;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

strong {
  color: #ffffff;
  font-size: clamp(2.5rem, 7vw, 5rem);
  line-height: 1;
  text-shadow: 0 0 18px rgba(250, 204, 21, 0.95), 0 2px 2px rgba(0, 0, 0, 0.8);
}

small {
  color: #d8f999;
  font-weight: 800;
}

.confetti {
  position: absolute;
  bottom: -2rem;
  width: 44vw;
  height: 82vh;
}

.confetti.left { left: 0; }
.confetti.right { right: 0; transform: scaleX(-1); }

.confetti span {
  position: absolute;
  left: var(--x);
  bottom: var(--y);
  width: 0.48rem;
  height: 1.12rem;
  border-radius: 2px;
  background: hsl(var(--hue), 94%, 62%);
  box-shadow: 0 0 12px hsla(var(--hue), 94%, 62%, 0.58);
  transform: rotate(var(--rot-start));
  animation: confetti-burst 2.25s cubic-bezier(.16,.84,.34,1) both;
  animation-delay: var(--delay);
}

.confetti span:nth-child(3n) {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
}

.confetti span:nth-child(4n) {
  width: 0.95rem;
  height: 0.38rem;
}

.confetti span:nth-child(5n) {
  width: 0.34rem;
  height: 1.35rem;
}

@keyframes confetti-burst {
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(var(--rot-start)) scale(0.45);
  }
  6% {
    opacity: 1;
    transform: translate(var(--mid-x), var(--mid-y)) rotate(var(--rot-mid)) scale(var(--scale-pop));
  }
  82% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) rotate(var(--rot-end)) scale(var(--scale-end));
  }
}

@keyframes card-glow {
  0% { opacity: 0; transform: translateX(-50%) scale(0.86); }
  14% { opacity: 1; transform: translateX(-50%) scale(1.06); }
  70% { opacity: 1; filter: brightness(1.15); }
  100% { opacity: 0; transform: translateX(-50%) scale(1); }
}
</style>
