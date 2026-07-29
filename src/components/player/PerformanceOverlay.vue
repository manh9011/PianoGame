<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { playbackProfilerSnapshot, type PlaybackProfilerSnapshot, type PlaybackProfilerSpanStat } from '../../modules/perf/playbackProfiler'
import PerformanceTimeline from './PerformanceTimeline.vue'

const props = withDefaults(defineProps<{
  variant?: 'mini' | 'detail'
  snapshotOverride?: PlaybackProfilerSnapshot | null
}>(), {
  variant: 'mini',
  snapshotOverride: null,
})

const emit = defineEmits<{
  openDetail: []
  closeDetail: []
}>()

const { t } = useI18n()
const collapsed = ref(new Set<string>())

type SortKey = 'impact' | 'avgMs' | 'maxMs' | 'calls' | 'lastMs'
const sortKey = ref<SortKey>('impact')
const selectedIndex = ref(0)

const activeSnapshot = computed(() => props.snapshotOverride ?? playbackProfilerSnapshot.value)
const selectedSample = computed(() => {
  const timeline = activeSnapshot.value.timeline
  const maxIndex = Math.max(0, timeline.times.length - 1)
  const index = Math.max(0, Math.min(maxIndex, selectedIndex.value))
  return {
    index,
    time: timeline.times[index] ?? 0,
    fps: timeline.fps[index] ?? 0,
    renderMs: timeline.renderMs[index] ?? 0,
    simulationMs: timeline.simulationMs[index] ?? 0,
  }
})

watch(() => activeSnapshot.value.timeline.times.length, length => {
  selectedIndex.value = Math.max(0, length - 1)
}, { immediate: true })

function formatMs(value: number) {
  return value < 10 ? value.toFixed(2) : value.toFixed(1)
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString()
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe - minutes * 60
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}

function miniPoints(values: number[]) {
  if (values.length < 2) return ''
  const recent = values.slice(-28)
  const max = Math.max(...recent, 1)
  const min = Math.min(...recent, max)
  const span = Math.max(1, max - min)
  return recent.map((value, index) => {
    const x = recent.length <= 1 ? 0 : index * 100 / (recent.length - 1)
    const y = 28 - ((value - min) / span) * 24
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function toggleRow(row: PlaybackProfilerSpanStat) {
  if (!row.children) return
  const next = new Set(collapsed.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  collapsed.value = next
}

function expandAll() {
  collapsed.value = new Set()
}

function collapseAll() {
  collapsed.value = new Set(groupRows.value.map(row => row.id))
}

function sortValue(row: PlaybackProfilerSpanStat) {
  if (sortKey.value === 'avgMs') return row.avgMs
  if (sortKey.value === 'maxMs') return row.maxMs
  if (sortKey.value === 'calls') return row.calls
  if (sortKey.value === 'lastMs') return row.lastMs
  return row.percent
}

const selectedSpanStats = computed(() => {
  if (props.variant === 'detail') return activeSnapshot.value.timeline.spanStats[selectedSample.value.index] ?? activeSnapshot.value.spanStats
  return activeSnapshot.value.spanStats
})
const groupRows = computed(() => selectedSpanStats.value.filter(row => row.depth === 0))
const childRows = computed(() => selectedSpanStats.value.filter(row => row.depth > 0))
const sortedRows = computed(() => {
  const output: PlaybackProfilerSpanStat[] = []
  const groups = [...groupRows.value].sort((a, b) => sortValue(b) - sortValue(a))
  for (const group of groups) {
    output.push(group)
    if (collapsed.value.has(group.id)) continue
    const children = childRows.value
      .filter(row => row.parent === group.id)
      .sort((a, b) => sortValue(b) - sortValue(a))
    output.push(...children)
  }
  return output
})

const latestSlowEvents = computed(() => activeSnapshot.value.slowEvents.slice(0, 5))
const topImpact = computed(() => sortedRows.value.find(row => row.depth > 0) ?? sortedRows.value[0])
const miniPolyline = computed(() => miniPoints(activeSnapshot.value.timeline.fps))
</script>

<template>
  <button
    v-if="variant === 'mini' && activeSnapshot.enabled"
    class="performance-mini"
    type="button"
    :aria-label="t('perf.openDetails')"
    @click="emit('openDetail')"
  >
    <span class="mini-top"><strong>{{ t('perf.fps') }}</strong><b>{{ formatNumber(activeSnapshot.render.gauges.fps ?? 0) }}</b></span>
    <svg class="mini-chart" viewBox="0 0 100 30" aria-hidden="true">
      <polyline v-if="miniPolyline" :points="miniPolyline" />
    </svg>
  </button>

  <aside v-else-if="activeSnapshot.enabled" class="performance-detail" :aria-label="t('perf.title')">
    <header class="performance-detail__header">
      <div class="title-block">
        <strong>{{ t('perf.title') }}</strong>
        <span>{{ t('perf.pausedInspecting') }}</span>
      </div>
      <button class="close-button" type="button" @click="emit('closeDetail')">{{ t('common.close') }}</button>
    </header>

    <section class="kpi-strip">
      <div class="kpi"><span>{{ t('perf.fps') }}</span><b>{{ formatNumber(selectedSample.fps) }}</b></div>
      <div class="kpi"><span>{{ t('perf.render') }}</span><b>{{ formatMs(selectedSample.renderMs) }}</b></div>
      <div class="kpi"><span>{{ t('perf.simulation') }}</span><b>{{ formatMs(selectedSample.simulationMs) }}</b></div>
      <div class="kpi"><span>{{ t('perf.timeline') }}</span><b>{{ formatClock(selectedSample.time) }}</b></div>
      <div class="kpi"><span>{{ t('perf.sample') }}</span><b>{{ selectedSample.index + 1 }}/{{ Math.max(1, activeSnapshot.timeline.times.length) }}</b></div>
      <div class="kpi kpi--wide"><span>{{ t('perf.hotspot') }}</span><code>{{ topImpact?.name ?? '—' }}</code></div>
    </section>

    <section class="timeline-panel">
      <h3>{{ t('perf.timeline') }}</h3>
      <PerformanceTimeline
        :timeline="activeSnapshot.timeline"
        :selected-index="selectedIndex"
        :fps-label="t('perf.fps')"
        :render-label="t('perf.render')"
        :simulation-label="t('perf.simulation')"
        :frame-ms-label="t('perf.frameMs')"
      />
      <label class="time-travel">
        <span>{{ t('perf.timeTravel') }}</span>
        <input v-model.number="selectedIndex" type="range" min="0" :max="Math.max(0, activeSnapshot.timeline.times.length - 1)" step="1" />
        <b>{{ selectedSample.index + 1 }}/{{ Math.max(1, activeSnapshot.timeline.times.length) }}</b>
      </label>
    </section>

    <section class="profiler-panel">
      <header class="profiler-toolbar">
        <h3>{{ t('perf.method') }}</h3>
        <div class="toolbar-actions">
          <label>
            <span>{{ t('perf.sortBy') }}</span>
            <select v-model="sortKey">
              <option value="impact">{{ t('perf.impact') }}</option>
              <option value="avgMs">{{ t('perf.avgMs') }}</option>
              <option value="maxMs">{{ t('perf.maxMs') }}</option>
              <option value="calls">{{ t('perf.calls') }}</option>
              <option value="lastMs">{{ t('perf.lastMs') }}</option>
            </select>
          </label>
          <button type="button" @click="expandAll">{{ t('perf.expandAll') }}</button>
          <button type="button" @click="collapseAll">{{ t('perf.collapseAll') }}</button>
        </div>
      </header>

      <div class="profiler-grid" role="table">
        <div class="profiler-row profiler-row--head" role="row">
          <span>{{ t('perf.method') }}</span>
          <span>{{ t('perf.lane') }}</span>
          <span>{{ t('perf.avgMs') }}</span>
          <span>{{ t('perf.maxMs') }}</span>
          <span>{{ t('perf.calls') }}</span>
          <span>{{ t('perf.impact') }}</span>
          <span>{{ t('perf.lastMs') }}</span>
        </div>
        <button
          v-for="row in sortedRows"
          :key="row.id"
          class="profiler-row"
          :class="{ 'profiler-row--group': row.depth === 0, 'profiler-row--hot': row.id === topImpact?.id }"
          type="button"
          role="row"
          @click="toggleRow(row)"
        >
          <span class="method-cell" :style="{ paddingLeft: `${row.depth * 1.15}rem` }">
            <span v-if="row.children" class="caret">{{ collapsed.has(row.id) ? '▸' : '▾' }}</span>
            <span v-else class="caret"></span>
            <code>{{ row.name }}</code>
          </span>
          <span>{{ row.lane === 'render' ? t('perf.render') : t('perf.simulation') }}</span>
          <span>{{ formatMs(row.avgMs) }}</span>
          <span>{{ formatMs(row.maxMs) }}</span>
          <span>{{ row.calls }}</span>
          <span class="impact-cell">
            <i :style="{ width: `${Math.min(100, row.percent)}%` }"></i>
            <b>{{ formatNumber(row.percent) }}%</b>
          </span>
          <span>{{ formatMs(row.lastMs) }}</span>
        </button>
        <p v-if="!sortedRows.length" class="empty-text">{{ t('perf.noSamples') }}</p>
      </div>
    </section>

    <section class="events-panel">
      <h3>{{ t('perf.lastSlowEvent') }}</h3>
      <p v-if="!latestSlowEvents.length" class="empty-text">{{ t('perf.noData') }}</p>
      <div v-for="event in latestSlowEvents" :key="`${event.kind}:${event.currentUs}:${event.durationMs}`" class="event-row">
        <span>{{ event.kind }} · {{ Math.round(event.progressRatio * 100) }}%</span>
        <b>{{ formatMs(event.durationMs) }}</b>
        <code>{{ event.topSpans[0]?.name ?? '—' }}</code>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.performance-mini {
  position: absolute;
  top: 0.55rem;
  left: 0.55rem;
  z-index: 20;
  width: 142px;
  height: 54px;
  padding: 0.35rem 0.45rem;
  border: 1px solid rgba(190, 242, 100, 0.36);
  border-radius: 10px;
  background: rgba(8, 13, 24, 0.8);
  color: #e5f8ba;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px);
  cursor: pointer;
  font: 700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.performance-mini:hover,
.performance-mini:focus-visible {
  border-color: #bef264;
  outline: none;
}

.mini-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mini-top b {
  color: #ffffff;
}

.mini-chart {
  width: 100%;
  height: 28px;
}

.mini-chart polyline {
  fill: none;
  stroke: #bef264;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.performance-detail {
  position: fixed;
  inset: 0;
  z-index: 80;
  overflow: auto;
  padding: 0.85rem;
  background: rgba(8, 13, 24, 0.96);
  color: #e5f8ba;
  font: 600 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.performance-detail__header,
.title-block,
.kpi-strip,
.profiler-toolbar,
.toolbar-actions,
.event-row,
.time-travel {
  display: flex;
  align-items: center;
}

.performance-detail__header {
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
}

.title-block {
  gap: 0.75rem;
  color: #f7fee7;
}

.close-button,
.toolbar-actions select,
.toolbar-actions button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  background: rgba(30, 41, 59, 0.95);
  color: #f7fee7;
  font: inherit;
}

.close-button {
  padding: 0.4rem 0.65rem;
}

.kpi-strip {
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.55rem;
}

.kpi {
  display: inline-grid;
  grid-template-columns: auto auto;
  gap: 0.45rem;
  min-width: 8.2rem;
  padding: 0.38rem 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 9px;
  background: rgba(15, 23, 42, 0.7);
}

.kpi--wide {
  min-width: 18rem;
}

.kpi span,
.event-row span,
.time-travel span {
  color: #d9f99d;
}

.kpi b,
.event-row b,
.time-travel b {
  color: #fff;
}

.timeline-panel,
.profiler-panel,
.events-panel {
  margin-top: 0.55rem;
  padding: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.58);
}

.timeline-panel h3,
.profiler-panel h3,
.events-panel h3 {
  margin: 0 0 0.5rem;
  color: #fef9c3;
  font-size: 0.74rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.time-travel {
  gap: 0.55rem;
  margin-top: 0.55rem;
}

.time-travel input {
  flex: 1;
  accent-color: #bef264;
}

.profiler-toolbar {
  justify-content: space-between;
  gap: 0.75rem;
}

.toolbar-actions {
  gap: 0.55rem;
}

.toolbar-actions label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.profiler-grid {
  min-width: 760px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 10px;
}

.profiler-row {
  display: grid;
  grid-template-columns: minmax(210px, 2.2fr) 0.85fr 0.75fr 0.75fr 0.65fr 1.05fr 0.75fr;
  gap: 0.45rem;
  align-items: center;
  width: 100%;
  min-height: 1.85rem;
  padding: 0 0.55rem;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(15, 23, 42, 0.42);
  color: inherit;
  font: inherit;
  text-align: left;
}

.profiler-row--head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(30, 41, 59, 0.95);
  color: #fef9c3;
}

.profiler-row--group {
  background: rgba(31, 41, 55, 0.88);
  color: #f7fee7;
}

.profiler-row--hot:not(.profiler-row--head) {
  box-shadow: inset 3px 0 0 #f59e0b;
}

.method-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.25rem;
}

.caret {
  width: 0.8rem;
  color: #bef264;
}

code {
  min-width: 0;
  overflow: hidden;
  color: #93c5fd;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.impact-cell {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 1.2rem;
}

.impact-cell i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.55), rgba(190, 242, 100, 0.38));
}

.impact-cell b {
  position: relative;
  z-index: 1;
  color: #fff;
}

.event-row {
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 1.55rem;
}

.empty-text {
  margin: 0.5rem;
  color: rgba(229, 248, 186, 0.72);
}
</style>

