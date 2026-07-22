<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '../../stores/playerStore'
import { displayPoints, resolveComboBonus } from '../../modules/game/scoring'
import { isPlayableNote } from '../../modules/game/hitDetection'
const { t } = useI18n()
const player = usePlayerStore()

const isListenMode = computed(() => player.session?.mode === 'listen')
const countedListenNotes = computed(() => {
  const session = player.session
  if (!session) return []
  const soundedTrackIds = new Set(
    session.tracks
      .filter(track => track.mode !== 'notPlayed' && track.mode !== 'playedButHidden')
      .map(track => track.trackId)
  )
  return session.notes.filter(note => soundedTrackIds.has(note.trackId))
})
const playableTotal = computed(() => {
  const session = player.session
  if (!session) return 0
  if (isListenMode.value) return countedListenNotes.value.length
  return session.notes.filter(note => isPlayableNote(note, session.tracks, session.handSelection, session)).length
})
const hitNotes = computed(() => {
  const session = player.session
  if (!session) return 0
  if (isListenMode.value) return countedListenNotes.value.filter(note => note.start <= session.currentUs).length
  return session.score.notesUserActuallyPlayed
})
const errors = computed(() => player.session?.score ?? null)
const points = computed(() => displayPoints(player.session?.score.rawPoints ?? 0))
const comboBonus = computed(() => resolveComboBonus(player.session?.score.combo || 1))
const comboDisplay = computed(() => `${comboBonus.value.label} (${comboBonus.value.factor.toFixed(1)})`)
</script>

<template>
  <aside v-if="player.session" class="score-panel">
    <div class="score-live" :class="{ 'score-live--listen': isListenMode }">
      <span class="metric"><span class="muted">{{ t('score.notes') }}</span><strong>{{ hitNotes }}/{{ playableTotal }}</strong></span>
      <template v-if="!isListenMode">
        <span class="metric"><span class="muted">{{ t('score.errors') }}</span><strong>+{{ errors?.strayNotes ?? 0 }}/{{ errors?.missedNotes ?? 0 }}</strong></span>
        <span class="metric points"><span class="muted">{{ t('score.points') }}</span><strong>{{ points }} <small>{{ comboDisplay }}</small></strong></span>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.score-panel {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
  pointer-events: none;
}

.score-live {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.25rem 1.25rem;
  align-items: center;
  min-width: 15rem;
  padding: 0.5rem 0.65rem;
  border-radius: 4px;
  background: transparent;
  color: #f2f5f8;
  font-size: 0.92rem;
  line-height: 1.2;
}

.score-live--listen {
  grid-template-columns: auto;
  min-width: 0;
}

.metric {
  display: inline-flex;
  gap: 0.35rem;
  align-items: baseline;
  white-space: nowrap;
}

.metric.points {
  grid-column: 1 / -1;
}

.metric strong {
  font-size: 1rem;
}

.metric small {
  color: #d8f999;
  font-size: 0.86rem;
}

.muted {
  color: #c9cdd3;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: grid;
  place-items: center;
  z-index: 20;
  pointer-events: auto;
}

.modal {
  max-width: 920px;
  width: min(94vw, 920px);
  max-height: 92dvh;
  overflow: auto;
}

@media (max-width: 720px) {
  .score-live {
    min-width: 0;
    gap: 0.2rem 0.65rem;
    padding: 0.4rem 0.5rem;
    font-size: 0.75rem;
  }

  .metric strong {
    font-size: 0.82rem;
  }
}
</style>
