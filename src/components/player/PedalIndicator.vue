<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../../stores/playerStore'
import type { TranslatedControlChange } from '../../modules/midi/midiTypes'

const player = usePlayerStore()
const MIN_OFF_DURATION_US = 100_000 // 100ms in microseconds

interface ProcessedPedalEvent { timeUs: number; on: boolean }

function preprocessPedalEvents(events: TranslatedControlChange[], cc: number): ProcessedPedalEvent[] {
  const filtered = events.filter(e => e.controllerNumber === cc).sort((a, b) => a.timeUs - b.timeUs)
  const adjusted: ProcessedPedalEvent[] = []
  let lastIsOn = false
  let lastOffTimeUs = -1

  for (const evt of filtered) {
    const isOn = evt.value > 0
    let timeUs = evt.timeUs

    if (isOn) {
      if (!lastIsOn && lastOffTimeUs !== -1) {
        const offGap = timeUs - lastOffTimeUs
        if (offGap < MIN_OFF_DURATION_US) {
          timeUs = lastOffTimeUs + MIN_OFF_DURATION_US
        }
      }
      lastIsOn = true
    } else {
      if (lastIsOn && adjusted.length > 0) {
        const lastAdjustedTime = adjusted[adjusted.length - 1].timeUs
        if (timeUs < lastAdjustedTime) {
          timeUs = lastAdjustedTime
        }
      }
      lastOffTimeUs = timeUs
      lastIsOn = false
    }

    adjusted.push({ timeUs, on: isOn })
  }
  return adjusted
}

const sustainEvents = computed(() => {
  const cc = player.session?.controlChanges
  return cc?.length ? preprocessPedalEvents(cc, 64) : []
})
const sostenutoEvents = computed(() => {
  const cc = player.session?.controlChanges
  return cc?.length ? preprocessPedalEvents(cc, 66) : []
})
const softEvents = computed(() => {
  const cc = player.session?.controlChanges
  return cc?.length ? preprocessPedalEvents(cc, 67) : []
})

function isPedalOnAt(events: ProcessedPedalEvent[], timeUs: number): boolean {
  if (!events.length) return false
  let low = 0
  let high = events.length - 1
  let result = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (events[mid].timeUs <= timeUs) {
      result = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return result >= 0 && events[result].on
}

const sustainOn = computed(() => {
  const currentUs = player.session?.currentUs ?? -Infinity
  return isPedalOnAt(sustainEvents.value, currentUs) || player.pedalState.sustain
})
const sostenutoOn = computed(() => {
  const currentUs = player.session?.currentUs ?? -Infinity
  return isPedalOnAt(sostenutoEvents.value, currentUs) || player.pedalState.sostenuto
})
const softOn = computed(() => {
  const currentUs = player.session?.currentUs ?? -Infinity
  return isPedalOnAt(softEvents.value, currentUs) || player.pedalState.soft
})
</script>

<template>
  <div class="pedal-indicator-container">
    <div class="pedal-track">
      <div class="pedal-line"></div>

      <div class="pedal-node">
        <div class="pedal-label">UNA</div>
        <div class="pedal-circle" :class="{ active: softOn }" title="Soft Pedal (CC 67)"></div>
      </div>

      <div class="pedal-node">
        <div class="pedal-label">SOS</div>
        <div class="pedal-circle" :class="{ active: sostenutoOn }" title="Sostenuto Pedal (CC 66)"></div>
      </div>

      <div class="pedal-node">
        <div class="pedal-label">SUS</div>
        <div class="pedal-circle" :class="{ active: sustainOn }" title="Sustain Pedal (CC 64)"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pedal-indicator-container {
  position: absolute;
  bottom: 24px;
  right: 24px;
  pointer-events: none;
  z-index: 5;
}

.pedal-track {
  position: relative;
  display: flex;
  gap: 32px;
  align-items: flex-end;
}

.pedal-line {
  position: absolute;
  bottom: 13px;
  /* Center of 28px circle minus 1px line thickness */
  left: 14px;
  right: 14px;
  height: 2px;
  background: rgba(255, 255, 255, 0.3);
  z-index: 0;
}

.pedal-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 1;
}

.pedal-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.pedal-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #2a2a2a;
  border: 2.5px solid rgba(255, 255, 255, 0.3);
}

.pedal-circle.active {
  background: #FFD700;
  border-color: #FFF;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.8), 0 0 5px rgba(255, 215, 0, 0.4);
}
</style>
