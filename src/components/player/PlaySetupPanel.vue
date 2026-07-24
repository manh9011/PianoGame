<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../../stores/playerStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { PLAY_MODE_CONFIGS, type HandSelection, type PlayMode } from '../../modules/game/playSession'
import type { ModeScoreEntry } from '../../types/profile'

const router = useRouter()
const player = usePlayerStore()
const profiles = useProfileStore()
const settings = useSettingsStore()
const mode = ref<PlayMode>('noteMemory')
const handSelection = ref<HandSelection>('right')
const speed = ref(settings.defaultSpeed)
const detailTab = ref<'instructions' | 'breakdown' | 'chart' | 'points'>('points')
const config = computed(() => PLAY_MODE_CONFIGS[mode.value])
const handLabels: Record<HandSelection, string> = { left: 'Left Hand', right: 'Right Hand', both: 'Both Hands' }
const modeTitles: Record<PlayMode, string> = {
  listen: 'Watch and Listen Only',
  noteMemory: 'Melody Practice',
  practice: 'Rhythm Practice',
  performance: 'Song Recital',
}
const modeColumns: { mode: PlayMode; title: string; subtitle: string }[] = [
  { mode: 'noteMemory', title: 'Practice the Melody', subtitle: 'Song waits for you' },
  { mode: 'practice', title: 'Practice the Rhythm', subtitle: 'Constant speed' },
  { mode: 'performance', title: 'Song Recital', subtitle: 'One try at full speed' },
]
const detailTabs = [
  { key: 'instructions', label: 'Instructions' },
  { key: 'breakdown', label: 'Progress Breakdown' },
  { key: 'chart', label: 'Line Chart' },
  { key: 'points', label: 'Points Earned' },
] as const
const selectedTitle = computed(() => mode.value === 'listen' ? modeTitles.listen : `${handLabels[handSelection.value]} • ${modeTitles[mode.value]}`)
const selectedBest = computed(() => scoreEntry(mode.value, handSelection.value))
const scoreRows = computed<ModeScoreEntry[]>(() => {
  const songId = player.song?.id
  if (!songId) return []
  return profiles.scoreEntriesFor(songId, mode.value, handSelection.value)
    .slice()
    .sort((a, b) => b.score - a.score || b.playedAt - a.playedAt)
})

watch(mode, value => {
  const fixed = PLAY_MODE_CONFIGS[value].fixedSpeed
  if (fixed) speed.value = fixed
})

function selectMode(nextMode: PlayMode, nextHand: HandSelection = handSelection.value) {
  mode.value = nextMode
  handSelection.value = nextHand
}

function scoreEntry(nextMode: PlayMode, nextHand: HandSelection) {
  const songId = player.song?.id
  if (!songId || nextMode === 'listen') return undefined
  return profiles.bestScoreFor(songId, nextMode, nextHand)
}

function scoreValue(nextMode: PlayMode, nextHand: HandSelection) {
  return scoreEntry(nextMode, nextHand)?.score ?? 0
}

function maxPoints(nextHand: HandSelection) { return nextHand === 'both' ? 15 : 10 }
function percent(value: number) { return `${Math.round(value * 100)}%` }
function date(ms: number) { return ms ? new Date(ms).toLocaleString() : '-' }

async function start() {
  await player.prepareAudio(settings.midiOutputId)
  player.configureSession({ mode: mode.value, handSelection: handSelection.value, speed: speed.value })
  player.start()
}

async function selectAndStart(nextMode: PlayMode, nextHand: HandSelection) {
  selectMode(nextMode, nextHand)
  await start()
}
</script>

<template>
  <section class="setup-wrap">
    <header class="setup-header">
      <button class="header-button secondary" @click="router.push('/library')">Songs</button>
      <div class="song-heading">
        <span class="top-score">{{ selectedBest?.score ?? 0 }}</span>
        <span class="song-title">{{ player.song?.title }}</span>
      </div>
      <button class="header-button secondary" @click="start">Continue</button>
    </header>

    <section class="setup-modes">
      <aside class="setup-tools">
        <button class="utility-card" :class="{ active: mode === 'listen' }" @click="selectMode('listen', 'both')" @dblclick="selectAndStart('listen', 'both')">
          Watch and Listen Only
        </button>
        <div class="utility-card setup-options">
          <span>Hands, Colors, and Instruments</span>
          <label class="speed-control">
            <span>Speed</span>
            <input v-model.number="speed" type="number" min="0" max="400" step="10" :disabled="!config.speedChangeAllowed" />
          </label>
          <small v-if="!config.speedChangeAllowed" class="muted">Fixed 100%</small>
        </div>
      </aside>

      <section v-for="item in modeColumns" :key="item.mode" class="mode-column">
        <header class="mode-heading">
          <h2>{{ item.title }}</h2>
          <p>{{ item.subtitle }}</p>
        </header>
        <div class="hand-pair">
          <button
            v-for="hand in (['left', 'right'] as HandSelection[])"
            :key="hand"
            class="score-card"
            :class="{ active: mode === item.mode && handSelection === hand }"
            @click="selectMode(item.mode, hand)"
            @dblclick="selectAndStart(item.mode, hand)"
          >
            <span class="card-score">{{ scoreValue(item.mode, hand) }}<small>/{{ maxPoints(hand) }}</small></span>
            <span>{{ handLabels[hand] }}</span>
          </button>
        </div>
        <button class="score-card both-card" :class="{ active: mode === item.mode && handSelection === 'both' }" @click="selectMode(item.mode, 'both')" @dblclick="selectAndStart(item.mode, 'both')">
          <span class="card-score">{{ scoreValue(item.mode, 'both') }}<small>/{{ maxPoints('both') }}</small></span>
          <span>Both Hands</span>
        </button>
      </section>
    </section>

    <h1 class="selection-title">{{ selectedTitle }}</h1>

    <section class="setup-detail-area">
      <nav class="detail-tabs" aria-label="Setup details">
        <button
          v-for="tab in detailTabs"
          :key="tab.key"
          class="detail-tab"
          :class="{ active: detailTab === tab.key }"
          @click="detailTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section class="detail-panel">
        <template v-if="detailTab === 'instructions'">
          <h2>Instructions</h2>
          <p v-if="mode === 'listen'" class="muted">Nghe toàn bài với phần mềm tự chơi. Chế độ này không tính điểm.</p>
          <p v-else-if="mode === 'noteMemory'" class="muted">Chơi đúng nốt của {{ handLabels[handSelection] }}. Bài sẽ chờ bạn và dừng khi bấm sai nốt.</p>
          <p v-else-if="mode === 'practice'" class="muted">Chơi theo nhịp ở tốc độ đã chọn. Sai nốt không dừng bài.</p>
          <p v-else class="muted">Chơi một lượt ở tốc độ 100%. Không pause trong khi biểu diễn.</p>
        </template>

        <template v-else-if="detailTab === 'breakdown'">
          <h2>Progress Breakdown</h2>
          <div class="breakdown-grid">
            <div class="breakdown-card"><span>Best Points</span><strong>{{ selectedBest?.score ?? 0 }}</strong></div>
            <div class="breakdown-card"><span>Grade</span><strong>{{ selectedBest?.grade ?? '-' }}</strong></div>
            <div class="breakdown-card"><span>Notes Hit</span><strong>{{ selectedBest ? percent(selectedBest.accuracy) : '-' }}</strong></div>
            <div class="breakdown-card"><span>Actual Speed</span><strong>{{ selectedBest?.averageSpeed ? `${selectedBest.averageSpeed}%` : '-' }}</strong></div>
          </div>
        </template>

        <template v-else-if="detailTab === 'chart'">
          <h2>Line Chart</h2>
          <div class="chart-placeholder">
            <span v-for="entry in scoreRows.slice().reverse()" :key="`${entry.playedAt}-${entry.score}`" :style="{ height: `${Math.max(8, Math.min(100, entry.score))}%` }" />
          </div>
          <p v-if="!scoreRows.length" class="muted">Chưa có dữ liệu để vẽ biểu đồ.</p>
        </template>

        <template v-else>
          <table class="points-table">
            <thead>
              <tr>
                <th><span class="sort-arrow">▲</span>Name</th>
                <th>Points</th>
                <th>Notes Hit</th>
                <th>Errors</th>
                <th>Actual Speed</th>
                <th>Time Spent</th>
                <th>Date Earned</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in scoreRows" :key="`${entry.mode}-${entry.handSelection}-${entry.playedAt}`">
                <td>{{ handLabels[entry.handSelection] }} • {{ modeTitles[entry.mode] }}</td>
                <td>{{ entry.score }}</td>
                <td>{{ percent(entry.accuracy) }}</td>
                <td>{{ entry.failed ? 'Failed' : '0' }}</td>
                <td>{{ entry.averageSpeed }}%</td>
                <td>-</td>
                <td>{{ date(entry.playedAt) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!scoreRows.length" class="empty-table muted">Chưa có điểm cho lựa chọn này.</p>
        </template>
      </section>
    </section>
  </section>
</template>

<style scoped>
.setup-wrap {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  background: #3b3b3b;
  color: #eeeeee;
  overflow: hidden;
}

.setup-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 45px;
  padding: 0.35rem 0.5rem;
  background: #2f2f2f;
}

.header-button {
  padding: 0.38rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: #2f2f2f;
  white-space: nowrap;
}

.song-heading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-width: 0;
}

.top-score {
  min-width: 3.75rem;
  padding: 0.1rem 0.65rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.16);
  color: #8f8f8f;
  font-size: 2rem;
  line-height: 1;
  text-align: center;
}

.song-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setup-modes {
  display: grid;
  grid-template-columns: minmax(13rem, 0.8fr) repeat(3, minmax(12rem, 1fr));
  gap: clamp(1rem, 4vw, 4.5rem);
  align-items: end;
  padding: 1.35rem clamp(1rem, 10vw, 16rem) 1.75rem;
  background: #3b3b3b;
}

.setup-tools,
.mode-column {
  display: grid;
  gap: 0.45rem;
}

.utility-card,
.score-card {
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 4px;
  background: #666666;
  color: #e8e8e8;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.12);
}

.utility-card {
  min-height: 6rem;
  display: grid;
  place-items: center;
  padding: 0.75rem;
  text-align: center;
}

.utility-card.active,
.score-card.active {
  border-color: #c8c8c8;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18), inset 0 0 12px rgba(255, 255, 255, 0.22);
}

.setup-options {
  gap: 0.6rem;
  align-content: center;
}

.speed-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.speed-control input {
  width: 5rem;
  padding: 0.25rem 0.35rem;
  border-radius: 4px;
  background: #4a4a4a;
}

.mode-heading {
  min-height: 3.1rem;
  text-align: center;
}

.mode-heading h2 {
  margin: 0;
  font-size: clamp(1.2rem, 1.5vw, 1.45rem);
  font-weight: 500;
}

.mode-heading p {
  margin: 0;
  color: #9e9e9e;
}

.hand-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
}

.score-card {
  min-height: 6rem;
  display: grid;
  place-items: center;
  gap: 0.1rem;
  padding: 0.6rem;
}

.both-card {
  min-height: 5.75rem;
}

.card-score {
  color: #b8b8b8;
  font-size: 2.25rem;
  line-height: 1;
}

.card-score small {
  font-size: 1rem;
}

.selection-title {
  margin: 0;
  padding: 0.65rem 1rem;
  background: #2f2f2f;
  text-align: center;
  font-size: clamp(1.35rem, 1.8vw, 1.65rem);
  font-weight: 500;
}

.setup-detail-area {
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  background: #3b3b3b;
  overflow: hidden;
}

.detail-tabs {
  display: grid;
  align-content: start;
  border-right: 1px solid #151515;
}

.detail-tab {
  min-height: 45px;
  padding: 0 0.5rem;
  border-radius: 0;
  border-bottom: 1px solid #222222;
  background: transparent;
  text-align: left;
}

.detail-tab.active {
  background: #aaaaaa;
  color: #ffffff;
}

.detail-panel {
  min-height: 0;
  margin: 0.55rem 0.55rem 0.5rem 0.6rem;
  padding: 0.75rem 1rem;
  border: 1px solid #1b1b1b;
  border-radius: 10px;
  background: #3c3c3c;
  overflow: auto;
}

.detail-panel h2 {
  margin-top: 0;
}

.points-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.points-table th,
.points-table td {
  padding: 0.55rem;
  text-align: left;
  white-space: nowrap;
}

.points-table th {
  color: #eeeeee;
  font-weight: 500;
}

.points-table tbody tr {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sort-arrow {
  margin-right: 0.75rem;
  color: #9f9f9f;
}

.empty-table {
  margin: 2rem 0 0;
  text-align: center;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(8rem, 1fr));
  gap: 0.75rem;
}

.breakdown-card {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.12);
}

.breakdown-card strong {
  font-size: 1.75rem;
}

.chart-placeholder {
  display: flex;
  align-items: end;
  gap: 0.35rem;
  height: 12rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.12);
}

.chart-placeholder span {
  width: 1rem;
  border-radius: 999px 999px 0 0;
  background: #8ae234;
}

@media (max-width: 1100px) {
  .setup-modes {
    grid-template-columns: repeat(2, minmax(12rem, 1fr));
    padding-inline: 1rem;
  }
}

@media (max-width: 760px) {
  .setup-wrap {
    min-height: 100dvh;
    overflow: auto;
  }

  .setup-header,
  .setup-detail-area {
    grid-template-columns: 1fr;
  }

  .song-heading {
    order: -1;
  }

  .setup-modes {
    grid-template-columns: 1fr;
  }

  .detail-tabs {
    grid-template-columns: repeat(2, 1fr);
    border-right: 0;
  }

  .breakdown-grid {
    grid-template-columns: 1fr;
  }
}
</style>
