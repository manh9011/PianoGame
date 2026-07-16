<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { PlaybackProfilerTimelineSnapshot } from '../../modules/perf/playbackProfiler'

const props = defineProps<{
  timeline: PlaybackProfilerTimelineSnapshot
  selectedIndex?: number
  fpsLabel: string
  renderLabel: string
  simulationLabel: string
  frameMsLabel: string
}>()

const fpsChartRef = ref<HTMLDivElement | null>(null)
const msChartRef = ref<HTMLDivElement | null>(null)
let fpsChart: uPlot | null = null
let msChart: uPlot | null = null
let resizeObserver: ResizeObserver | null = null
let width = 520

const selectedTime = computed(() => props.timeline.times[Math.max(0, Math.min(props.timeline.times.length - 1, props.selectedIndex ?? props.timeline.times.length - 1))] ?? null)

function chartWidth() {
  return Math.max(280, Math.round(fpsChartRef.value?.clientWidth || width))
}

function makeOptions(label: string, series: uPlot.Series[], height: number): uPlot.Options {
  return {
    width: chartWidth(),
    height,
    cursor: { drag: { x: false, y: false } },
    legend: { show: true, live: false },
    scales: { x: { time: false } },
    axes: [
      {
        stroke: 'rgba(229,248,186,0.62)',
        grid: { stroke: 'rgba(255,255,255,0.08)', width: 1 },
        ticks: { stroke: 'rgba(255,255,255,0.16)', width: 1 },
        values: (_u, vals) => vals.map(value => `${Math.round(value)}s`),
      },
      {
        stroke: 'rgba(229,248,186,0.62)',
        grid: { stroke: 'rgba(255,255,255,0.08)', width: 1 },
        ticks: { stroke: 'rgba(255,255,255,0.16)', width: 1 },
      },
    ],
    series: [
      { label },
      ...series,
    ],
  }
}

function emptyData(seriesCount: number): uPlot.AlignedData {
  return Array.from({ length: seriesCount + 1 }, () => [] as number[]) as unknown as uPlot.AlignedData
}

function fpsData(): uPlot.AlignedData {
  const { times, fps } = props.timeline
  return [times, fps] as uPlot.AlignedData
}

function msData(): uPlot.AlignedData {
  const { times, renderMs, simulationMs } = props.timeline
  return [times, renderMs, simulationMs] as uPlot.AlignedData
}

function createCharts() {
  if (!fpsChartRef.value || !msChartRef.value) return
  width = chartWidth()
  fpsChart = new uPlot(makeOptions(props.fpsLabel, [
    { label: props.fpsLabel, stroke: '#bef264', width: 2, points: { show: false } },
  ], 112), props.timeline.times.length ? fpsData() : emptyData(1), fpsChartRef.value)
  msChart = new uPlot(makeOptions(props.frameMsLabel, [
    { label: props.renderLabel, stroke: '#60a5fa', width: 2, points: { show: false } },
    { label: props.simulationLabel, stroke: '#f59e0b', width: 2, points: { show: false } },
  ], 124), props.timeline.times.length ? msData() : emptyData(2), msChartRef.value)
}

function destroyCharts() {
  fpsChart?.destroy()
  msChart?.destroy()
  fpsChart = null
  msChart = null
}

function updateCharts() {
  if (!fpsChart || !msChart) return
  fpsChart.setData(props.timeline.times.length ? fpsData() : emptyData(1))
  msChart.setData(props.timeline.times.length ? msData() : emptyData(2))
  syncCursor()
}

function syncCursor() {
  if (selectedTime.value === null || !fpsChart || !msChart) return
  fpsChart.setCursor({ left: Math.round(fpsChart.valToPos(selectedTime.value, 'x')), top: 0 }, false)
  msChart.setCursor({ left: Math.round(msChart.valToPos(selectedTime.value, 'x')), top: 0 }, false)
}

function resizeCharts() {
  const nextWidth = chartWidth()
  if (nextWidth === width) return
  width = nextWidth
  fpsChart?.setSize({ width, height: 112 })
  msChart?.setSize({ width, height: 124 })
}

watch(() => props.timeline, updateCharts, { deep: false })
watch(selectedTime, syncCursor)

onMounted(() => {
  createCharts()
  if (fpsChartRef.value) {
    resizeObserver = new ResizeObserver(resizeCharts)
    resizeObserver.observe(fpsChartRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  destroyCharts()
})
</script>

<template>
  <div class="performance-timeline">
    <div ref="fpsChartRef" class="timeline-chart"></div>
    <div ref="msChartRef" class="timeline-chart"></div>
  </div>
</template>

<style scoped>
.performance-timeline {
  display: grid;
  gap: 0.45rem;
}

.timeline-chart {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.66);
}

:deep(.uplot) {
  background: transparent;
  color: #e5f8ba;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

:deep(.u-title) { color: #fef9c3; }
:deep(.u-legend) { color: #d9f99d; }
:deep(.u-label) { color: #e5f8ba; }
:deep(.u-value) { color: #ffffff; }
</style>
