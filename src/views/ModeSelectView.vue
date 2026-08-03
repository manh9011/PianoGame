<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/playerStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { PLAY_MODE_CONFIGS, type HandSelection, type PlayMode } from '../modules/game/playSession'
import { achievementFromHistory, entryAchievementBreakdown, topAchievementAttempts } from '../modules/game/achievementScoring'
import { achievementColorStyle } from '../modules/game/achievementColors'
import { trackSelectionKeyForTracks } from '../modules/game/scoreKeys'
import { HAND_SELECTION_COLORS } from '../modules/game/handAssignment'
import type { ModeScoreEntry } from '../types/profile'
import { formatDate } from '../i18n/formatters'
import AchievementCelebration from '../components/player/AchievementCelebration.vue'
import ModeScoreTimeline from '../components/player/ModeScoreTimeline.vue'
import type { AchievementCelebration as AchievementCelebrationState } from '../stores/profileStore'

import BaseButton from '../components/ui/BaseButton.vue'
import BaseTable, { type TableColumn } from '../components/ui/BaseTable.vue'

const DEBUG = import.meta.env.DEV
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const library = useLibraryStore()
const player = usePlayerStore()
const profiles = useProfileStore()
const settings = useSettingsStore()
const mode = ref<PlayMode>('noteMemory')
const handSelection = ref<HandSelection>('right')
const speed = ref(settings.defaultSpeed)
const detailTab = ref<'instructions' | 'breakdown' | 'chart' | 'points'>('points')
const sortColumn = ref<'playIndex' | 'name' | 'points' | 'accuracy' | 'errors' | 'speed' | 'time' | 'date'>('points')
const sortDirection = ref<'asc' | 'desc'>('desc')
const achievementCelebration = ref<AchievementCelebrationState | null>(null)
const animatedAchievementScores = ref<Record<string, number>>({})
let achievementFrameId: number | null = null
const config = computed(() => PLAY_MODE_CONFIGS[mode.value])
const handLabelKeys: Record<HandSelection, string> = { left: 'modeSelect.hands.left', right: 'modeSelect.hands.right', both: 'modeSelect.hands.both' }
const modeTitleKeys: Record<PlayMode, string> = {
  listen: 'modeSelect.modes.listen',
  noteMemory: 'modeSelect.modes.noteMemory',
  practice: 'modeSelect.modes.practice',
  performance: 'modeSelect.modes.performance',
}
const modeColumns: { mode: PlayMode; titleKey: string; subtitleKey: string }[] = [
  { mode: 'noteMemory', titleKey: 'modeSelect.columns.noteMemoryTitle', subtitleKey: 'modeSelect.columns.noteMemorySubtitle' },
  { mode: 'practice', titleKey: 'modeSelect.columns.practiceTitle', subtitleKey: 'modeSelect.columns.practiceSubtitle' },
  { mode: 'performance', titleKey: 'modeSelect.columns.performanceTitle', subtitleKey: 'modeSelect.columns.performanceSubtitle' },
]
const detailTabs = [
  { key: 'instructions', labelKey: 'modeSelect.tabs.instructions' },
  { key: 'breakdown', labelKey: 'modeSelect.tabs.breakdown' },
  { key: 'chart', labelKey: 'modeSelect.tabs.chart' },
  { key: 'points', labelKey: 'modeSelect.tabs.points' },
] as const
const selectedTitle = computed(() => mode.value === 'listen' ? t(modeTitleKeys.listen) : `${t(handLabelKeys[handSelection.value])} • ${t(modeTitleKeys[mode.value])}`)
const selectedScoreEntries = computed<ModeScoreEntry[]>(() => {
  const songId = player.song?.id
  if (!songId) return []
  return profiles.scoreEntriesFor(songId, mode.value, handSelection.value, currentTrackSelectionKey.value)
})
const selectedAchievementBreakdown = computed(() => achievementFromHistory(selectedScoreEntries.value))
const selectedAchievementScore = computed(() => selectedAchievementBreakdown.value?.total ?? 0)
const selectedBestGameplay = computed(() => formatScore(selectedAchievementScore.value))
const breakdownAttempts = computed(() => topAchievementAttempts(selectedScoreEntries.value))
const needsTrackConfig = computed(() => player.session?.needsTrackConfiguration ?? false)
const currentTrackSelectionKey = computed(() => trackSelectionKeyForTracks(player.session?.tracks))
const isMusicXml = computed(() => {
  const song = player.song
  if (!song) return false
  return song.sourceType === 'musicxml' || song.sourceType === 'hybrid' || song.hasMusicXmlSource
})
const chartEntries = computed<ModeScoreEntry[]>(() => selectedScoreEntries.value.slice().sort((a, b) => a.playedAt - b.playedAt))
type ScoreRowItem = ModeScoreEntry & { playIndex: number; isLatest: boolean };

const scoreRows = computed<ScoreRowItem[]>(() => {
  const entries = selectedScoreEntries.value.slice()
  entries.sort((a, b) => a.playedAt - b.playedAt)
  const items = entries.map((entry, index) => ({
    ...entry,
    playIndex: index + 1,
    isLatest: index === entries.length - 1
  }))

  return items.sort((a, b) => {
    let aVal: string | number
    let bVal: string | number

    switch (sortColumn.value) {
      case 'playIndex':
        aVal = a.playIndex
        bVal = b.playIndex
        break
      case 'name':
        aVal = profiles.activeProfile.name
        bVal = profiles.activeProfile.name
        break
      case 'points':
        aVal = a.gameplayPoints ?? a.score
        bVal = b.gameplayPoints ?? b.score
        break
      case 'accuracy':
        aVal = a.accuracy
        bVal = b.accuracy
        break
      case 'errors':
        aVal = a.errors ?? (a.failed ? 1 : 0)
        bVal = b.errors ?? (b.failed ? 1 : 0)
        break
      case 'speed':
        aVal = a.averageSpeed
        bVal = b.averageSpeed
        break
      case 'time':
        aVal = a.timeSpentUs ?? 0
        bVal = b.timeSpentUs ?? 0
        break
      case 'date':
        aVal = a.playedAt
        bVal = b.playedAt
        break
    }

    if (aVal === bVal) {
      return a.playIndex - b.playIndex
    }

    if (sortDirection.value === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    }
  })
})

const latestPlayedAt = computed(() => {
  const entries = selectedScoreEntries.value
  if (!entries.length) return undefined
  return Math.max(...entries.map(e => e.playedAt))
})

const pointsColumns: TableColumn[] = [
  { key: 'playIndex', label: '#', sortable: true, width: '48px', align: 'center' },
  { key: 'name', label: t('modeSelect.table.name'), sortable: true },
  { key: 'points', label: t('modeSelect.table.points'), sortable: true },
  { key: 'accuracy', label: t('modeSelect.table.notesHit'), sortable: true },
  { key: 'errors', label: t('modeSelect.table.errors'), sortable: true },
  { key: 'speed', label: t('modeSelect.table.actualSpeed'), sortable: true },
  { key: 'time', label: t('modeSelect.table.timeSpent'), sortable: true },
  { key: 'date', label: t('modeSelect.table.dateEarned'), sortable: true },
]

const breakdownColumns = computed<TableColumn[]>(() => [
  { key: 'label', label: '', width: '44%' },
  { key: 'achievement', label: t('modeSelect.breakdown.achievement'), align: 'center', width: '14%' },
  { key: 'attempt1', label: '#1', align: 'center', width: '14%' },
  { key: 'attempt2', label: '#2', align: 'center', width: '14%' },
  { key: 'attempt3', label: '#3', align: 'center', width: '14%' },
])

const breakdownRows = computed(() => {
  if (!breakdownAttempts.value.length) return []
  return [
    {
      id: 'notes',
      label: t('modeSelect.breakdown.hitEveryNote'),
      achievement: aggregateBreakdownScore('notes'),
      attempt1: breakdownScore(breakdownAttempts.value[0], 'notes'),
      attempt2: breakdownScore(breakdownAttempts.value[1], 'notes'),
      attempt3: breakdownScore(breakdownAttempts.value[2], 'notes'),
    },
    {
      id: 'hold',
      label: t('modeSelect.breakdown.holdFullDuration'),
      achievement: aggregateBreakdownScore('hold'),
      attempt1: breakdownScore(breakdownAttempts.value[0], 'hold'),
      attempt2: breakdownScore(breakdownAttempts.value[1], 'hold'),
      attempt3: breakdownScore(breakdownAttempts.value[2], 'hold'),
    },
    {
      id: 'speed',
      label: t('modeSelect.breakdown.closeToFullSpeed'),
      achievement: aggregateBreakdownScore('speed'),
      attempt1: breakdownScore(breakdownAttempts.value[0], 'speed'),
      attempt2: breakdownScore(breakdownAttempts.value[1], 'speed'),
      attempt3: breakdownScore(breakdownAttempts.value[2], 'speed'),
    },
    {
      id: 'date',
      label: t('modeSelect.breakdown.date'),
      achievement: '',
      attempt1: breakdownAttempts.value[0] ? date(breakdownAttempts.value[0].playedAt) : '--',
      attempt2: breakdownAttempts.value[1] ? date(breakdownAttempts.value[1].playedAt) : '--',
      attempt3: breakdownAttempts.value[2] ? date(breakdownAttempts.value[2].playedAt) : '--',
    },
  ]
})

function toggleSort(column: typeof sortColumn.value) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = ['date', 'points', 'time'].includes(column) ? 'desc' : 'asc'
  }
}

function handleSortDescChange(desc: boolean) {
  sortDirection.value = desc ? 'desc' : 'asc'
}

watch(mode, value => {
  const fixed = PLAY_MODE_CONFIGS[value].fixedSpeed
  if (fixed) speed.value = fixed
})

onMounted(async () => {
  const routeHash = route.params.hash as string | undefined
  const fallbackHash = player.song?.playbackHash ?? player.song?.hash
  const hash = routeHash ?? fallbackHash

  if (!hash) {
    router.replace('/library')
    return
  }

  if (!routeHash) {
    router.replace(`/mode-select/${hash}`)
  }

  const song = library.songByHash(hash)
  if (!song) {
    console.warn('Không tìm thấy bài hát với hash:', hash)
    router.replace('/library')
    return
  }

  if (!player.song || (player.song.playbackHash ?? player.song.hash) !== hash) {
    await player.loadSong(song, settings.defaultSpeed, settings.leadInDuration, settings.zoomPercent, settings.octaveShift)
  }

  profiles.markRecent(song.id)
  const celebration = profiles.lastAchievementCelebration
  if (celebration?.songId === song.id) {
    selectMode(celebration.mode, celebration.handSelection)
    achievementCelebration.value = profiles.consumeAchievementCelebration(song.id, celebration.mode, celebration.handSelection, currentTrackSelectionKey.value)
    if (achievementCelebration.value) animateAchievementScore(achievementCelebration.value)
  }
})

onBeforeUnmount(() => {
  if (achievementFrameId !== null) cancelAnimationFrame(achievementFrameId)
})

function selectMode(nextMode: PlayMode, nextHand: HandSelection = handSelection.value) {
  mode.value = nextMode
  handSelection.value = nextHand
}

function scoreEntry(nextMode: PlayMode, nextHand: HandSelection) {
  const songId = player.song?.id
  if (!songId || nextMode === 'listen') return undefined
  return profiles.bestScoreFor(songId, nextMode, nextHand, currentTrackSelectionKey.value)
}

function achievementKey(nextMode: PlayMode, nextHand: HandSelection) {
  return `${nextMode}:${nextHand}`
}

function scoreValue(nextMode: PlayMode, nextHand: HandSelection) {
  const key = achievementKey(nextMode, nextHand)
  const animated = animatedAchievementScores.value[key]
  if (animated !== undefined) return animated
  const songId = player.song?.id
  if (!songId || nextMode === 'listen') return 0
  return achievementFromHistory(profiles.scoreEntriesFor(songId, nextMode, nextHand, currentTrackSelectionKey.value))?.total ?? 0
}

function animateAchievementScore(celebration: AchievementCelebrationState) {
  const key = achievementKey(celebration.mode, celebration.handSelection)
  const startedAt = performance.now()
  const durationMs = 1400
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / durationMs)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedAchievementScores.value = {
      ...animatedAchievementScores.value,
      [key]: Math.round((celebration.from + (celebration.to - celebration.from) * eased) * 10) / 10,
    }
    if (progress < 1) {
      achievementFrameId = requestAnimationFrame(step)
      return
    }
    achievementFrameId = null
  }
  if (achievementFrameId !== null) cancelAnimationFrame(achievementFrameId)
  achievementFrameId = requestAnimationFrame(step)
}

function maxPoints(nextHand: HandSelection) { return nextHand === 'both' ? 15 : 10 }
function scoreCardStyle(nextMode: PlayMode, nextHand: HandSelection) {
  return {
    ...achievementColorStyle(scoreValue(nextMode, nextHand), maxPoints(nextHand)),
    '--hand-color': HAND_SELECTION_COLORS[nextHand],
  }
}
function formatScore(value?: number) {
  if (value === undefined) return '--'
  return String(Math.round(value))
}
function breakdownScore(entry: ModeScoreEntry | undefined, key: 'notes' | 'hold' | 'speed') {
  if (!entry) return '--'
  const breakdown = entryAchievementBreakdown(entry)
  const value = breakdown[key]
  const max = breakdown[`${key}Max`]
  return `${formatScore(value)} / ${max}`
}
function aggregateBreakdownScore(key: 'notes' | 'hold' | 'speed') {
  const breakdown = selectedAchievementBreakdown.value
  if (!breakdown) return '--'
  const value = breakdown[key]
  const max = breakdown[`${key}Max`]
  return `${formatScore(value)} / ${max}`
}
function formatDuration(us?: number) {
  if (!us) return '-'
  const totalSeconds = Math.round(us / 1_000_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
function date(ms: number) { return ms ? formatDate(ms, settings.locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-' }

async function testAchievementCelebration() {
  const songId = player.song?.id ?? '__test__'
  const testMode = mode.value === 'listen' ? 'noteMemory' : mode.value
  const testHand = mode.value === 'listen' ? 'right' : handSelection.value
  const max = maxPoints(testHand)
  const current = scoreValue(testMode, testHand)
  const from = Math.min(current, Math.max(0, max - 1))
  const to = Math.min(max, from + 1)
  achievementCelebration.value = null
  await nextTick()
  const celebration: AchievementCelebrationState = {
    songId,
    mode: testMode,
    handSelection: testHand,
    trackSelectionKey: currentTrackSelectionKey.value,
    from,
    to,
    playedAt: Date.now(),
  }
  selectMode(celebration.mode, celebration.handSelection)
  achievementCelebration.value = celebration
  animateAchievementScore(celebration)
}



async function startPlay() {
  const song = player.song
  const hash = song?.playbackHash ?? song?.hash
  if (!song || !hash) return
  await player.prepareAudio(settings.midiOutputId)
  player.configureSession({ mode: mode.value, handSelection: handSelection.value, speed: speed.value })
  const modeId = mode.value === 'listen' ? 'listen' : `${mode.value}-${handSelection.value}`
  router.push(`/play/${hash}/${modeId}`)
}

async function selectAndStart(nextMode: PlayMode, nextHand: HandSelection) {
  if (needsTrackConfig.value && nextMode !== 'listen') return
  selectMode(nextMode, nextHand)
  await startPlay()
}

function goToTrackSettings() {
  const song = player.song
  const hash = song?.playbackHash ?? song?.hash
  if (!song || !hash) return
  router.push(`/track-settings/${hash}`)
}

import { useShortcuts } from '../composables/useShortcuts'

useShortcuts({
  menuContinue: startPlay,
  menuBack: () => router.push('/library'),
})
</script>

<template>
  <section class="setup-wrap">
    <AchievementCelebration
      v-if="achievementCelebration"
      :celebration="achievementCelebration"
      @done="achievementCelebration = null"
    />
    <header class="setup-header">
      <div class="header-actions">
        <BaseButton variant="secondary" class="header-btn" @click="router.push('/library')">{{ t('modeSelect.songs') }}</BaseButton>
        <BaseButton v-if="DEBUG" variant="secondary" class="header-btn" @click="testAchievementCelebration">{{ t('modeSelect.testCelebration') }}</BaseButton>
      </div>
      <div class="song-heading">
        <span class="top-score" :style="achievementColorStyle(selectedAchievementScore, maxPoints(handSelection))">{{ selectedBestGameplay }}</span>
        <span class="song-title">{{ player.song?.title }}</span>
        <span v-if="isMusicXml" class="source-badge musicxml">MusicXML</span>
        <span v-else class="source-badge midi">MIDI</span>
      </div>
      <BaseButton variant="primary" class="header-btn" @click="startPlay">{{ t('modeSelect.continue') }}</BaseButton>
    </header>

    <section class="setup-modes">
      <aside class="setup-tools">
        <button class="utility-card" :class="{ active: mode === 'listen' }" @click="selectMode('listen', 'both')" @dblclick="selectAndStart('listen', 'both')">
          {{ t('modeSelect.listen') }}
        </button>
        <button class="utility-card" :class="{ 'needs-attention': needsTrackConfig }" @click="goToTrackSettings">
          {{ t('modeSelect.trackSettings') }}
        </button>
        <div v-if="needsTrackConfig" class="config-warning">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{{ t('modeSelect.trackConfigWarning') }}</span>
        </div>
      </aside>

      <section v-for="item in modeColumns" :key="item.mode" class="mode-column">
        <header class="mode-heading">
          <h2>{{ t(item.titleKey) }}</h2>
          <p>{{ t(item.subtitleKey) }}</p>
        </header>
        <div class="hand-pair">
          <button
            v-for="hand in (['left', 'right'] as HandSelection[])"
            :key="hand"
            class="score-card"
            :class="{ active: mode === item.mode && handSelection === hand, disabled: needsTrackConfig }"
            :style="scoreCardStyle(item.mode, hand)"
            :disabled="needsTrackConfig"
            @click="selectMode(item.mode, hand)"
            @dblclick="selectAndStart(item.mode, hand)"
          >
            <span class="card-score">{{ formatScore(scoreValue(item.mode, hand)) }}<small>/{{ maxPoints(hand) }}</small></span>
            <span class="hand-label"><span class="hand-swatch" aria-hidden="true"></span>{{ t(handLabelKeys[hand]) }}</span>
          </button>
        </div>
        <button class="score-card both-card" :class="{ active: mode === item.mode && handSelection === 'both', disabled: needsTrackConfig }" :style="scoreCardStyle(item.mode, 'both')" :disabled="needsTrackConfig" @click="selectMode(item.mode, 'both')" @dblclick="selectAndStart(item.mode, 'both')">
          <span class="card-score">{{ formatScore(scoreValue(item.mode, 'both')) }}<small>/{{ maxPoints('both') }}</small></span>
          <span class="hand-label"><span class="hand-swatch" aria-hidden="true"></span>{{ t('modeSelect.hands.both') }}</span>
        </button>
      </section>
    </section>

    <h1 class="selection-title">{{ selectedTitle }}</h1>

    <section class="setup-detail-area">
      <nav class="detail-tabs" :aria-label="t('modeSelect.detailTabsAria')">
        <button
          v-for="tab in detailTabs"
          :key="tab.key"
          class="detail-tab"
          :class="{ active: detailTab === tab.key }"
          @click="detailTab = tab.key"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>

      <section class="detail-panel">
        <template v-if="detailTab === 'instructions'">
          <div class="detail-content instructions-content">
            <template v-if="mode === 'listen'">
              <p class="muted">{{ t('modeSelect.instructions.listen') }}</p>
            </template>
            <template v-else-if="mode === 'noteMemory'">
              <p>{{ t('modeSelect.instructions.noteMemoryIntro') }}</p>
              <ul>
                <li>{{ t('modeSelect.instructions.noteMemorySlow') }}</li>
                <li>{{ t('modeSelect.instructions.noteMemoryAvoid') }}</li>
                <li>{{ t('modeSelect.instructions.noteMemoryHold') }}</li>
              </ul>
              <p>{{ t('modeSelect.instructions.noteMemoryWarning') }}</p>
            </template>
            <template v-else-if="mode === 'practice'">
              <p>{{ t('modeSelect.instructions.practiceIntro') }}</p>
              <ul>
                <li>{{ t('modeSelect.instructions.practiceFast') }}</li>
                <li>{{ t('modeSelect.instructions.practiceBuild') }}</li>
                <li>{{ t('modeSelect.instructions.practiceMelody') }}</li>
              </ul>
              <p>{{ t('modeSelect.instructions.practiceWarning') }}</p>
            </template>
            <template v-else>
              <p>{{ t('modeSelect.instructions.performanceIntro') }}</p>
              <p>{{ t('modeSelect.instructions.performanceWarning') }}</p>
            </template>
          </div>
        </template>

        <template v-else-if="detailTab === 'breakdown'">
          <div class="detail-content breakdown-content">
            <p class="breakdown-note">{{ t('modeSelect.breakdown.note') }}</p>
            <BaseTable
              :columns="breakdownColumns"
              :data="breakdownRows"
              :hoverable="false"
              bordered
              class="breakdown-table-override"
              row-key="id"
            >
              <template #cell-achievement="{ value }">
                <span :class="{ muted: value === '--' || !value }">{{ value || '' }}</span>
              </template>
              <template #cell-attempt1="{ value }">
                <span :class="{ muted: value === '--' }">{{ value }}</span>
              </template>
              <template #cell-attempt2="{ value }">
                <span :class="{ muted: value === '--' }">{{ value }}</span>
              </template>
              <template #cell-attempt3="{ value }">
                <span :class="{ muted: value === '--' }">{{ value }}</span>
              </template>
              <template #empty>
                <p class="empty-table muted">{{ t('modeSelect.breakdown.empty') }}</p>
              </template>
            </BaseTable>
          </div>
        </template>

        <template v-else-if="detailTab === 'chart'">
          <div class="detail-content chart-content">
            <ModeScoreTimeline
              :entries="chartEntries"
              :hand-selection="handSelection"
              :empty-label="t('modeSelect.chart.empty')"
              :locale="settings.locale"
            />
          </div>
        </template>

        <template v-else>
          <BaseTable
            :columns="pointsColumns"
            :data="scoreRows"
            :sort-by="sortColumn"
            :sort-desc="sortDirection === 'desc'"
            @update:sort-by="toggleSort($event as any)"
            @update:sort-desc="handleSortDescChange"
            :hoverable="false"
            bordered
            class="points-table-override"
            row-key="playedAt"
            :selected-key="latestPlayedAt"
          >
            <template #cell-playIndex="{ item }">
              {{ item.playIndex }}
            </template>
            <template #cell-name="{ item }">
              {{ profiles.activeProfile.name }}
            </template>
            <template #cell-points="{ item }">
              {{ item.gameplayPoints ?? item.score }}
            </template>
            <template #cell-accuracy="{ item }">
              {{ item.notesHit ?? '-' }}
            </template>
            <template #cell-errors="{ item }">
              {{ item.errors ?? (item.failed ? 1 : 0) }}
            </template>
            <template #cell-speed="{ item }">
              {{ item.averageSpeed }}%
            </template>
            <template #cell-time="{ item }">
              {{ formatDuration(item.timeSpentUs) }}
            </template>
            <template #cell-date="{ item }">
              {{ date(item.playedAt) }}
            </template>
            <template #empty>
              <p class="empty-table muted">{{ t('modeSelect.table.empty') }}</p>
            </template>
          </BaseTable>
        </template>
      </section>
    </section>
  </section>
</template>

<style scoped>
.setup-wrap {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  overflow: hidden;
}

.setup-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 48px;
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-header);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.setup-header :deep(.base-btn),
.header-button {
  height: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  background: var(--achievement-bg, rgba(0, 0, 0, 0.16));
  color: var(--achievement-color, #8f8f8f);
  font-size: 2rem;
  line-height: 1;
  text-align: center;
}

.song-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-badge {
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.source-badge.musicxml {
  background-color: #2196f3;
}

.source-badge.midi {
  background-color: #f44336;
}

.setup-modes {
  display: grid;
  grid-template-columns: minmax(13rem, 0.8fr) repeat(3, minmax(12rem, 1fr));
  gap: clamp(1rem, 4vw, 4.5rem);
  align-items: end;
  padding: 1.35rem clamp(1rem, 10vw, 16rem) 1.75rem;
  background: var(--color-bg-secondary);
}

.setup-tools,
.mode-column {
  display: grid;
  gap: 0.45rem;
}

.utility-card,
.score-card {
  border: 1px solid var(--color-border-default);
  border-radius: 4px;
  background: var(--achievement-bg, var(--color-btn-secondary-bg));
  color: var(--achievement-color, var(--color-text-primary));
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
  border-color: var(--achievement-border, #c8c8c8);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18), inset 0 0 12px rgba(255, 255, 255, 0.22);
}

.utility-card.needs-attention {
  border-color: #ffa500;
  background: #8b6500;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 165, 0, 0.7); }
  50% { box-shadow: 0 0 0 8px rgba(255, 165, 0, 0); }
}

.config-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #ffa500;
  border-radius: 4px;
  background: rgba(255, 165, 0, 0.15);
  color: #ffa500;
  font-size: 0.85rem;
  text-align: left;
}

.config-warning i {
  flex-shrink: 0;
  font-size: 1.1rem;
}

.score-card:disabled,
.score-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
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
  color: var(--color-text-muted);
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
  position: relative;
}

.both-card {
  min-height: 5.75rem;
}

.card-score {
  color: color-mix(in srgb, var(--achievement-color, #e8e8e8) 84%, transparent);
  font-size: 2.25rem;
  line-height: 1;
  transition: color 0.25s ease, text-shadow 0.25s ease, transform 0.25s ease;
}

.score-card.active .card-score {
  color: #fff4a3;
  text-shadow: 0 0 16px rgba(250, 204, 21, 0.82), 0 0 28px rgba(250, 204, 21, 0.45);
  transform: scale(1.06);
}

.card-score small {
  font-size: 1rem;
}

.hand-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.hand-swatch {
  width: 0.65rem;
  height: 0.65rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--hand-color);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.18), 0 0 10px color-mix(in srgb, var(--hand-color) 58%, transparent);
}

.selection-title {
  margin: 0;
  padding: 0.65rem 1rem;
  background: var(--color-bg-header);
  text-align: center;
  font-size: clamp(1.35rem, 1.8vw, 1.65rem);
  font-weight: 500;
}

.setup-detail-area {
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  background: var(--color-bg-secondary);
}

.detail-tabs {
  display: flex;
  flex-direction: column;
  align-content: start;
  background: #343436;
  border-inline-end: 1px solid rgba(255, 255, 255, 0.12);
}

.detail-tab {
  min-height: 44px;
  padding: 0.75rem 1rem;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.92rem;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.detail-tab:hover:not(.active) {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.detail-tab.active {
  background: #8e8e93;
  color: #ffffff;
  font-weight: 500;
}

.detail-panel {
  min-height: 0;
  margin: 0.55rem 0.55rem 0.5rem 0.6rem;
  padding: 0;
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;
  background: var(--color-bg-elevated);
  overflow: auto;
}

.detail-content {
  padding: 1rem;
}

.detail-content.chart-content {
  height: 100%;
  padding: 0;
}

.detail-content h2 {
  margin-top: 0;
}

.points-table-override {
  width: 100%;
  height: 100%;
}

.points-table-override :deep(.base-table-row) {
  background: transparent;
  color: var(--color-text-muted);
}

.points-table-override :deep(.base-table-row.is-selected) {
  background: rgba(255, 255, 255, 0.06) !important;
  color: var(--color-text-primary) !important;
}

:deep(.base-table) {
  font-size: 0.85rem;
}

:deep(.base-table th) {
  background: var(--color-bg-elevated);
}

.sort-arrow {
  display: inline-block;
  margin-inline-end: 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  transition: transform 0.2s, color 0.2s;
}

.sort-arrow.active {
  color: var(--color-text-primary);
}

.sort-arrow.desc {
  transform: rotate(180deg);
}

.empty-table {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
}

.breakdown-content {
  padding-top: 0.75rem;
}

.breakdown-note {
  margin: 0 0 0.5rem;
  color: var(--color-text-primary);
  font-size: 0.88rem;
}

.breakdown-table-override {
  border: 1px solid var(--color-border-strong, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.08);
}

.breakdown-table-override :deep(th) {
  background: rgba(0, 0, 0, 0.22);
  font-size: 1.1rem;
  font-weight: 500;
  padding: 0.45rem 0.75rem;
}

.breakdown-table-override :deep(th:not(:first-child)) {
  color: #eeff44;
}

.breakdown-table-override :deep(td) {
  padding: 0.35rem 0.75rem;
}

.breakdown-table-override :deep(.base-table-row:not(:last-child) td:not(:first-child)) {
  color: #eeff44;
}

.breakdown-table-override :deep(.base-table-row:last-child) {
  border-top: 1px solid var(--color-border-default, rgba(255, 255, 255, 0.15));
}

.breakdown-table-override :deep(.base-table-row:last-child td) {
  color: var(--color-text-primary);
}

.breakdown-table-override :deep(.muted) {
  color: #8f8f8f !important;
}

.breakdown-empty-state {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 2rem;
  color: var(--color-text-muted);
  font-size: 1.15rem;
  line-height: 1.45;
  text-align: left;
}

.breakdown-empty-state p {
  max-width: 28rem;
  margin: 0;
}

.chart-content {
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .setup-modes {
    grid-template-columns: repeat(2, minmax(12rem, 1fr));
    padding-inline: 1rem;
  }
}

@media (max-width: 760px) {
  .setup-wrap {
    height: 100dvh;
    overflow: hidden;
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
    border-inline-end: 0;
  }

  .breakdown-row {
    grid-template-columns: minmax(12rem, 1fr) repeat(4, minmax(4.5rem, 0.18fr));
    font-size: 0.85rem;
  }

  .breakdown-header-row {
    font-size: 1rem;
  }
}
</style>
