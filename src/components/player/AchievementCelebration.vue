<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AchievementCelebration } from '../../stores/profileStore'
import achievementUrl from '../../../achievement.mid?url'

const props = defineProps<{ celebration: AchievementCelebration }>()
const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()

const displayScore = ref(props.celebration.from)
let frameId: number | null = null
let timeoutId: number | null = null
let startedAt = 0

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function animate(now: number) {
  if (!startedAt) startedAt = now
  const progress = Math.min(1, (now - startedAt) / 1400)
  displayScore.value = Math.round((props.celebration.from + (props.celebration.to - props.celebration.from) * easeOutCubic(progress)) * 10) / 10
  if (progress < 1) frameId = requestAnimationFrame(animate)
}

async function playAchievementSound() {
  try {
    const audio = new Audio(achievementUrl)
    audio.volume = 0.9
    await audio.play()
  } catch (error) {
    console.warn('Không phát được achievement.mid.', error)
  }
}

onMounted(() => {
  frameId = requestAnimationFrame(animate)
  void playAchievementSound()
  timeoutId = window.setTimeout(() => emit('done'), 2400)
})

onBeforeUnmount(() => {
  if (frameId !== null) cancelAnimationFrame(frameId)
  if (timeoutId !== null) window.clearTimeout(timeoutId)
})
</script>

<template>
  <div class="achievement-celebration" aria-live="polite">
    <div class="confetti left">
      <span v-for="i in 28" :key="`l-${i}`" :style="{ '--i': i }" />
    </div>
    <div class="confetti right">
      <span v-for="i in 28" :key="`r-${i}`" :style="{ '--i': i }" />
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
  z-index: 80;
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
  width: 26vw;
  height: 60vh;
}

.confetti.left { left: 0; }
.confetti.right { right: 0; transform: scaleX(-1); }

.confetti span {
  --hue: calc(12deg * var(--i));
  position: absolute;
  left: calc((var(--i) % 7) * 11% + 6%);
  bottom: 0;
  width: 0.52rem;
  height: 0.85rem;
  border-radius: 2px;
  background: hsl(var(--hue), 88%, 62%);
  transform: rotate(calc(var(--i) * 17deg));
  animation: confetti-burst 1.65s cubic-bezier(.1,.75,.22,1) both;
  animation-delay: calc((var(--i) % 8) * 28ms);
}

@keyframes confetti-burst {
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(0deg) scale(0.6);
  }
  10% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translate(calc(7vw + (var(--i) % 5) * 3vw), calc(-42vh - (var(--i) % 9) * 3vh)) rotate(calc(var(--i) * 53deg)) scale(1);
  }
}

@keyframes card-glow {
  0% { opacity: 0; transform: translateX(-50%) scale(0.86); }
  14% { opacity: 1; transform: translateX(-50%) scale(1.06); }
  70% { opacity: 1; filter: brightness(1.15); }
  100% { opacity: 0; transform: translateX(-50%) scale(1); }
}
</style>
