<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'

const { t } = useI18n()
const player = usePlayerStore()
const nowMs = ref(performance.now())
let raf: number | null = null

function stopTicking() {
  if (raf !== null) cancelAnimationFrame(raf)
  raf = null
}

function tick() {
  const now = performance.now()
  nowMs.value = now
  const feedback = player.session?.score.feedback
  if (feedback && feedback.visibleUntilMs > now) {
    raf = requestAnimationFrame(tick)
    return
  }
  raf = null
}

function startTicking() {
  if (raf !== null) return
  tick()
}

watch(() => player.session?.score.feedback?.sequence, sequence => {
  if (sequence) startTicking()
  else stopTicking()
}, { immediate: true })

onBeforeUnmount(() => {
  stopTicking()
})

const feedback = computed(() => player.session?.score.feedback ?? null)
const visible = computed(() => !!feedback.value && feedback.value.visibleUntilMs > nowMs.value)
const judgement = computed(() => {
  const value = feedback.value?.judgement
  if (!value) return ''
  return t(`score.${value}Judgement`)
})
const comboText = computed(() => t('score.combo', { count: feedback.value?.combo ?? 1 }))
</script>

<template>
  <div v-if="visible" class="gameplay-feedback" :key="feedback?.sequence">
    <div class="combo-text">{{ comboText }}</div>
    <div class="judgement-text" :class="feedback?.judgement">{{ judgement }}</div>
  </div>
</template>

<style scoped>
.gameplay-feedback {
  position: absolute;
  left: 50%;
  top: 24%;
  z-index: 12;
  transform: translate(-50%, -50%);
  pointer-events: none;
  text-align: center;
  animation: feedback-pop 850ms ease-out both;
}

.combo-text,
.judgement-text {
  color: #ffffff;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: 0.01em;
  text-shadow:
    0 2px 2px rgba(0, 0, 0, 0.95),
    0 0 4px rgba(0, 0, 0, 0.9),
    0 0 10px rgba(255, 255, 255, 0.35);
}

.combo-text {
  font-size: clamp(0.725rem, 1.55vw, 1.3rem);
}

.judgement-text {
  margin-top: 0.05rem;
  font-size: clamp(0.625rem, 1.25vw, 1.075rem);
}

.judgement-text.perfect { color: #fef08a; }
.judgement-text.great { color: #bbf7d0; }
.judgement-text.good { color: #bfdbfe; }
.judgement-text.ok { color: #e9d5ff; }
.judgement-text.barely { color: #fed7aa; }

@keyframes feedback-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.82);
  }
  16% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.05);
  }
  70% {
    opacity: 1;
    transform: translate(-50%, -54%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -62%) scale(0.96);
  }
}
</style>
