<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { HAND_SELECTION_COLORS } from '../../modules/game/handAssignment'
import type { HandSelection } from '../../modules/game/playSession'
import type { ModeScoreEntry } from '../../types/profile'

const props = defineProps<{
  entries: ModeScoreEntry[]
  handSelection: HandSelection
  emptyLabel: string
  locale: string
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chart: uPlot | null = null
let resizeObserver: ResizeObserver | null = null
let width = 640
let height = 260

const hasData = computed(() => props.entries.length > 0)
const lineColor = computed(() => HAND_SELECTION_COLORS[props.handSelection])

function chartWidth() {
  return Math.max(240, Math.round(chartRef.value?.clientWidth || width))
}

function chartHeight() {
  return Math.max(160, Math.round(chartRef.value?.clientHeight || height))
}

function pointValue(entry: ModeScoreEntry) {
  return entry.gameplayPoints ?? entry.score
}

function chartData(): uPlot.AlignedData {
  return [
    props.entries.map(entry => Math.round(entry.playedAt / 1000)),
    props.entries.map(pointValue),
  ] as uPlot.AlignedData
}

function valueRange(_u: uPlot, _min: number, max: number): [number, number] {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1
  return [0, Math.ceil(safeMax * 1.12)]
}

function makeDateFormatter() {
  return new Intl.DateTimeFormat(props.locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function makeOptions(): uPlot.Options {
  const dateFormatter = makeDateFormatter()
  return {
    width: chartWidth(),
    height: chartHeight(),
    padding: [8, 8, 4, 4],
    cursor: { drag: { x: false, y: false } },
    legend: { show: false },
    scales: {
      x: { time: true },
      y: { range: valueRange },
    },
    axes: [
      {
        stroke: 'rgba(238,238,238,0.62)',
        grid: { stroke: 'rgba(255,255,255,0.08)', width: 1 },
        ticks: { stroke: 'rgba(255,255,255,0.14)', width: 1 },
        size: 46,
        values: (_u, vals) => vals.map(value => dateFormatter.format(value * 1000)),
      },
      {
        stroke: 'rgba(238,238,238,0.62)',
        grid: { stroke: 'rgba(255,255,255,0.08)', width: 1 },
        ticks: { stroke: 'rgba(255,255,255,0.14)', width: 1 },
        size: 48,
        values: (_u, vals) => vals.map(value => `${Math.round(value)}`),
      },
    ],
    series: [
      {},
      {
        stroke: lineColor.value,
        width: 2,
        points: {
          show: true,
          size: 7,
          width: 2,
          stroke: lineColor.value,
          fill: '#3c3c3c',
        },
      },
    ],
  }
}

function destroyChart() {
  chart?.destroy()
  chart = null
}

function createChart() {
  if (!chartRef.value || !hasData.value) return
  width = chartWidth()
  height = chartHeight()
  chart = new uPlot(makeOptions(), chartData(), chartRef.value)
}

function updateChart() {
  if (!hasData.value) {
    destroyChart()
    return
  }
  if (!chart) {
    createChart()
    return
  }
  chart.setData(chartData())
}

async function recreateChart() {
  destroyChart()
  await nextTick()
  createChart()
}

function resizeChart() {
  if (!chart) return
  const nextWidth = chartWidth()
  const nextHeight = chartHeight()
  if (nextWidth === width && nextHeight === height) return
  width = nextWidth
  height = nextHeight
  chart.setSize({ width, height })
}

watch(() => props.entries, updateChart, { deep: false })
watch(() => [props.handSelection, props.locale], recreateChart)

onMounted(() => {
  createChart()
  if (chartRef.value) {
    resizeObserver = new ResizeObserver(resizeChart)
    resizeObserver.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  destroyChart()
})
</script>

<template>
  <div class="mode-score-timeline" :style="{ '--hand-color': lineColor }">
    <div ref="chartRef" class="timeline-chart" :class="{ empty: !hasData }"></div>
    <div v-if="!hasData" class="timeline-empty">
      {{ emptyLabel }}
    </div>
  </div>
</template>

<style scoped>
.mode-score-timeline {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.12);
}

.timeline-chart {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.timeline-chart.empty {
  border: 1px dashed color-mix(in srgb, var(--hand-color) 46%, rgba(255, 255, 255, 0.16));
  border-radius: 8px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 48px 48px;
}

.timeline-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  color: #cfcfcf;
  font-size: clamp(1rem, 1.45vw, 1.3rem);
  text-align: center;
  pointer-events: none;
}

:deep(.uplot) {
  background: transparent;
  color: #eeeeee;
  font-family: inherit;
}

:deep(.u-over),
:deep(.u-under) {
  overflow: hidden;
}

:deep(.u-axis),
:deep(.u-label),
:deep(.u-value) {
  color: #d8d8d8;
}
</style>
