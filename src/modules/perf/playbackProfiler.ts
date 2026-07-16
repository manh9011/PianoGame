import { shallowRef } from 'vue'

export type PlaybackProfilerLane = 'simulation' | 'render'

export interface PlaybackProfilerMode {
  summaryEnabled: boolean
  detailEnabled: boolean
}

export interface PlaybackProfilerMeta {
  currentUs?: number
  progressRatio?: number
  notesTotal?: number
  rafDeltaMs?: number
}

export interface PlaybackProfilerContext {
  lane: PlaybackProfilerLane
  startMs: number
  currentUs: number
  progressRatio: number
  spans: Record<string, number>
  counters: Record<string, number>
  gauges: Record<string, number>
}

export interface PlaybackProfilerSummary {
  avgMs: number
  p95Ms: number
  maxMs: number
  lastMs: number
  slowCount: number
  samples: number
}

export interface PlaybackProfilerLaneSnapshot extends PlaybackProfilerSummary {
  spans: Record<string, number>
  counters: Record<string, number>
  gauges: Record<string, number>
}

export interface PlaybackProfilerSlowEvent {
  lane: PlaybackProfilerLane
  kind: string
  durationMs: number
  currentUs: number
  progressRatio: number
  topSpans: Array<{ name: string; ms: number }>
  counters: Record<string, number>
}

export interface PlaybackProfilerBucketSnapshot {
  index: number
  samples: number
  simulationAvgMs: number
  simulationP95Ms: number
  renderAvgMs: number
  renderP95Ms: number
  counters: Record<string, number>
}

export interface PlaybackProfilerTimelineSnapshot {
  times: number[]
  fps: number[]
  renderMs: number[]
  simulationMs: number[]
  spanStats: PlaybackProfilerSpanStat[][]
}

export interface PlaybackProfilerSpanStat {
  id: string
  lane: PlaybackProfilerLane
  name: string
  parent?: string
  depth: number
  totalMs: number
  selfMs: number
  avgMs: number
  maxMs: number
  lastMs: number
  calls: number
  percent: number
  children: number
}

export interface PlaybackProfilerSnapshot {
  enabled: boolean
  detailEnabled: boolean
  updatedAtMs: number
  simulation: PlaybackProfilerLaneSnapshot
  render: PlaybackProfilerLaneSnapshot
  slowEvents: PlaybackProfilerSlowEvent[]
  buckets: PlaybackProfilerBucketSnapshot[]
  timeline: PlaybackProfilerTimelineSnapshot
  spanStats: PlaybackProfilerSpanStat[]
}

const SAMPLE_LIMIT = 120
const TIMELINE_LIMIT = 240
const SLOW_EVENT_LIMIT = 12
const BUCKET_COUNT = 10
const PUBLISH_INTERVAL_MS = 250
const SIMULATION_SLOW_MS = 8
const RENDER_SLOW_MS = 16.7

interface LaneState {
  samples: number[]
  latestSpans: Record<string, number>
  latestCounters: Record<string, number>
  latestGauges: Record<string, number>
  slowCount: number
}

interface BucketState {
  simulation: number[]
  render: number[]
  counters: Record<string, { total: number; samples: number }>
}

interface SpanAggregate {
  lane: PlaybackProfilerLane
  name: string
  samples: number[]
  calls: number
  maxMs: number
  lastMs: number
}

const emptyLaneSnapshot = (): PlaybackProfilerLaneSnapshot => ({
  avgMs: 0,
  p95Ms: 0,
  maxMs: 0,
  lastMs: 0,
  slowCount: 0,
  samples: 0,
  spans: {},
  counters: {},
  gauges: {},
})

const emptyTimeline = (): PlaybackProfilerTimelineSnapshot => ({
  times: [],
  fps: [],
  renderMs: [],
  simulationMs: [],
  spanStats: [],
})

const createLaneState = (): LaneState => ({
  samples: [],
  latestSpans: {},
  latestCounters: {},
  latestGauges: {},
  slowCount: 0,
})

const createBucketState = (): BucketState => ({
  simulation: [],
  render: [],
  counters: {},
})

const mode: PlaybackProfilerMode = {
  summaryEnabled: false,
  detailEnabled: false,
}
let collecting = false

const lanes: Record<PlaybackProfilerLane, LaneState> = {
  simulation: createLaneState(),
  render: createLaneState(),
}

const buckets = Array.from({ length: BUCKET_COUNT }, createBucketState)
const slowEvents: PlaybackProfilerSlowEvent[] = []
const spanAggregates = new Map<string, SpanAggregate>()
const activeContexts: Partial<Record<PlaybackProfilerLane, PlaybackProfilerContext>> = {}
const timeline = emptyTimeline()
let timelineStartMs = 0
let lastPublishMs = 0

export const playbackProfilerSnapshot = shallowRef<PlaybackProfilerSnapshot>({
  enabled: false,
  detailEnabled: false,
  updatedAtMs: 0,
  simulation: emptyLaneSnapshot(),
  render: emptyLaneSnapshot(),
  slowEvents: [],
  buckets: buckets.map((_, index) => ({
    index,
    samples: 0,
    simulationAvgMs: 0,
    simulationP95Ms: 0,
    renderAvgMs: 0,
    renderP95Ms: 0,
    counters: {},
  })),
  timeline: emptyTimeline(),
  spanStats: [],
})

function nowMs() {
  return performance.now()
}

function pushBounded(values: number[], value: number, limit = SAMPLE_LIMIT) {
  values.push(value)
  if (values.length > limit) values.shift()
}

function average(values: number[]) {
  if (!values.length) return 0
  let total = 0
  for (const value of values) total += value
  return total / values.length
}

function sum(values: number[]) {
  let total = 0
  for (const value of values) total += value
  return total
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

function max(values: number[]) {
  let result = 0
  for (const value of values) result = Math.max(result, value)
  return result
}

function cloneNumbers(values: Record<string, number>) {
  return { ...values }
}

function bucketIndex(progressRatio: number) {
  if (!Number.isFinite(progressRatio)) return 0
  return Math.max(0, Math.min(BUCKET_COUNT - 1, Math.floor(progressRatio * BUCKET_COUNT)))
}

function resetProfilerState() {
  lanes.simulation = createLaneState()
  lanes.render = createLaneState()
  buckets.splice(0, buckets.length, ...Array.from({ length: BUCKET_COUNT }, createBucketState))
  slowEvents.splice(0, slowEvents.length)
  spanAggregates.clear()
  activeContexts.simulation = undefined
  activeContexts.render = undefined
  timeline.times.splice(0, timeline.times.length)
  timeline.fps.splice(0, timeline.fps.length)
  timeline.renderMs.splice(0, timeline.renderMs.length)
  timeline.simulationMs.splice(0, timeline.simulationMs.length)
  timeline.spanStats.splice(0, timeline.spanStats.length)
  timelineStartMs = nowMs()
  lastPublishMs = 0
}

function cloneSnapshot(): PlaybackProfilerSnapshot {
  const simulation = laneSnapshot('simulation')
  const render = laneSnapshot('render')
  return {
    enabled: mode.summaryEnabled,
    detailEnabled: mode.detailEnabled,
    updatedAtMs: nowMs(),
    simulation,
    render,
    slowEvents: slowEvents.slice(),
    buckets: buckets.map(bucketSnapshot),
    timeline: cloneTimeline(),
    spanStats: buildSpanStats(render, simulation),
  }
}

function addBucketSample(context: PlaybackProfilerContext, durationMs: number) {
  const bucket = buckets[bucketIndex(context.progressRatio)]
  pushBounded(bucket[context.lane], durationMs)
  for (const [name, value] of Object.entries({ ...context.counters, ...context.gauges })) {
    const item = bucket.counters[name] ?? { total: 0, samples: 0 }
    item.total += value
    item.samples += 1
    bucket.counters[name] = item
  }
}

function updateSpanAggregates(context: PlaybackProfilerContext) {
  for (const [name, value] of Object.entries(context.spans)) {
    const id = `${context.lane}:${name}`
    const aggregate = spanAggregates.get(id) ?? {
      lane: context.lane,
      name,
      samples: [],
      calls: 0,
      maxMs: 0,
      lastMs: 0,
    }
    pushBounded(aggregate.samples, value)
    aggregate.calls += 1
    aggregate.maxMs = Math.max(aggregate.maxMs, value)
    aggregate.lastMs = value
    spanAggregates.set(id, aggregate)
  }
}

function laneSnapshot(lane: PlaybackProfilerLane): PlaybackProfilerLaneSnapshot {
  const state = lanes[lane]
  return {
    avgMs: average(state.samples),
    p95Ms: percentile(state.samples, 0.95),
    maxMs: max(state.samples),
    lastMs: state.samples[state.samples.length - 1] ?? 0,
    slowCount: state.slowCount,
    samples: state.samples.length,
    spans: cloneNumbers(state.latestSpans),
    counters: cloneNumbers(state.latestCounters),
    gauges: cloneNumbers(state.latestGauges),
  }
}

function bucketSnapshot(bucket: BucketState, index: number): PlaybackProfilerBucketSnapshot {
  const counters: Record<string, number> = {}
  for (const [name, value] of Object.entries(bucket.counters)) {
    counters[name] = value.samples ? value.total / value.samples : 0
  }
  return {
    index,
    samples: Math.max(bucket.simulation.length, bucket.render.length),
    simulationAvgMs: average(bucket.simulation),
    simulationP95Ms: percentile(bucket.simulation, 0.95),
    renderAvgMs: average(bucket.render),
    renderP95Ms: percentile(bucket.render, 0.95),
    counters,
  }
}

function pushTimelineSample(now: number, spanStats: PlaybackProfilerSpanStat[]) {
  const render = laneSnapshot('render')
  const simulation = laneSnapshot('simulation')
  pushBounded(timeline.times, (now - timelineStartMs) / 1000, TIMELINE_LIMIT)
  pushBounded(timeline.fps, render.gauges.fps ?? 0, TIMELINE_LIMIT)
  pushBounded(timeline.renderMs, render.lastMs, TIMELINE_LIMIT)
  pushBounded(timeline.simulationMs, simulation.lastMs, TIMELINE_LIMIT)
  timeline.spanStats.push(spanStats.map(row => ({ ...row })))
  if (timeline.spanStats.length > TIMELINE_LIMIT) timeline.spanStats.shift()
}

function cloneTimeline(): PlaybackProfilerTimelineSnapshot {
  return {
    times: timeline.times.slice(),
    fps: timeline.fps.slice(),
    renderMs: timeline.renderMs.slice(),
    simulationMs: timeline.simulationMs.slice(),
    spanStats: timeline.spanStats.map(rows => rows.map(row => ({ ...row }))),
  }
}

function buildSpanStats(render: PlaybackProfilerLaneSnapshot, simulation: PlaybackProfilerLaneSnapshot): PlaybackProfilerSpanStat[] {
  const rows: PlaybackProfilerSpanStat[] = []
  const parentRows = new Map<string, PlaybackProfilerSpanStat>()
  const measuredSpanTotals: Record<PlaybackProfilerLane, number> = {
    render: 0,
    simulation: 0,
  }
  for (const aggregate of spanAggregates.values()) {
    measuredSpanTotals[aggregate.lane] += average(aggregate.samples)
  }

  for (const aggregate of spanAggregates.values()) {
    const parts = aggregate.name.split('.')
    const parentName = parts[0] ?? aggregate.name
    const parentId = `${aggregate.lane}:${parentName}`
    const avgMs = average(aggregate.samples)
    const totalMs = sum(aggregate.samples)
    const percent = measuredSpanTotals[aggregate.lane] > 0 ? avgMs / measuredSpanTotals[aggregate.lane] * 100 : 0
    const child: PlaybackProfilerSpanStat = {
      id: `${aggregate.lane}:${aggregate.name}`,
      lane: aggregate.lane,
      name: aggregate.name,
      parent: parentId,
      depth: 1,
      totalMs,
      selfMs: avgMs,
      avgMs,
      maxMs: aggregate.maxMs,
      lastMs: aggregate.lastMs,
      calls: aggregate.calls,
      percent,
      children: 0,
    }
    rows.push(child)

    const parent = parentRows.get(parentId) ?? {
      id: parentId,
      lane: aggregate.lane,
      name: parentName,
      depth: 0,
      totalMs: 0,
      selfMs: 0,
      avgMs: 0,
      maxMs: 0,
      lastMs: 0,
      calls: 0,
      percent: 0,
      children: 0,
    }
    parent.totalMs += totalMs
    parent.avgMs += avgMs
    parent.maxMs = Math.max(parent.maxMs, aggregate.maxMs)
    parent.lastMs += aggregate.lastMs
    parent.calls += aggregate.calls
    parent.children += 1
    parent.percent = measuredSpanTotals[aggregate.lane] > 0 ? parent.avgMs / measuredSpanTotals[aggregate.lane] * 100 : 0
    parentRows.set(parentId, parent)
  }

  return [...parentRows.values(), ...rows]
    .sort((a, b) => b.percent - a.percent || b.avgMs - a.avgMs)
}

function publishIfDue(force = false) {
  if (!mode.summaryEnabled) return
  if (!collecting && !force) return
  const now = nowMs()
  if (!force && now - lastPublishMs < PUBLISH_INTERVAL_MS) return
  lastPublishMs = now
  const simulation = laneSnapshot('simulation')
  const render = laneSnapshot('render')
  const spanStats = buildSpanStats(render, simulation)
  pushTimelineSample(now, spanStats)
  playbackProfilerSnapshot.value = {
    enabled: mode.summaryEnabled,
    detailEnabled: mode.detailEnabled,
    updatedAtMs: now,
    simulation,
    render,
    slowEvents: slowEvents.slice(),
    buckets: buckets.map(bucketSnapshot),
    timeline: cloneTimeline(),
    spanStats,
  }
}

function recordSlowEvent(context: PlaybackProfilerContext, durationMs: number) {
  const threshold = context.lane === 'render' ? RENDER_SLOW_MS : SIMULATION_SLOW_MS
  if (durationMs < threshold) return
  const state = lanes[context.lane]
  state.slowCount += 1
  if (!mode.detailEnabled) return

  const topSpans = Object.entries(context.spans)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, ms]) => ({ name, ms }))
  slowEvents.unshift({
    lane: context.lane,
    kind: context.lane === 'render' ? 'frame' : 'tick',
    durationMs,
    currentUs: context.currentUs,
    progressRatio: context.progressRatio,
    topSpans,
    counters: cloneNumbers({ ...context.counters, ...context.gauges }),
  })
  while (slowEvents.length > SLOW_EVENT_LIMIT) slowEvents.pop()
}

function begin(lane: PlaybackProfilerLane, meta: PlaybackProfilerMeta): PlaybackProfilerContext | null {
  if (!mode.summaryEnabled || !collecting) return null
  const context: PlaybackProfilerContext = {
    lane,
    startMs: nowMs(),
    currentUs: meta.currentUs ?? 0,
    progressRatio: meta.progressRatio ?? 0,
    spans: {},
    counters: {},
    gauges: {},
  }
  if (meta.notesTotal !== undefined) context.gauges.notesTotal = meta.notesTotal
  if (meta.rafDeltaMs !== undefined) context.gauges.rafDeltaMs = meta.rafDeltaMs
  activeContexts[lane] = context
  return context
}

function end(context: PlaybackProfilerContext | null) {
  if (!context || !mode.summaryEnabled) return
  if (activeContexts[context.lane] === context) delete activeContexts[context.lane]
  const durationMs = nowMs() - context.startMs
  const state = lanes[context.lane]
  pushBounded(state.samples, durationMs)
  state.latestSpans = cloneNumbers(context.spans)
  state.latestCounters = cloneNumbers(context.counters)
  state.latestGauges = cloneNumbers(context.gauges)
  addBucketSample(context, durationMs)
  updateSpanAggregates(context)
  recordSlowEvent(context, durationMs)
  publishIfDue()
}

export function setPlaybackProfilerMode(nextMode: PlaybackProfilerMode) {
  const wasEnabled = mode.summaryEnabled
  mode.summaryEnabled = nextMode.summaryEnabled
  mode.detailEnabled = nextMode.summaryEnabled && nextMode.detailEnabled
  collecting = mode.summaryEnabled
  if (!mode.summaryEnabled) {
    playbackProfilerSnapshot.value = {
      ...playbackProfilerSnapshot.value,
      enabled: false,
      detailEnabled: false,
      updatedAtMs: nowMs(),
    }
    return
  }
  if (!wasEnabled) resetProfilerState()
  collecting = true
  publishIfDue(true)
}

export function freezePlaybackProfiler() {
  collecting = false
  publishIfDue(true)
  return cloneSnapshot()
}

export function resumePlaybackProfiler() {
  if (!mode.summaryEnabled) return
  collecting = true
  publishIfDue(true)
}

export function isPlaybackProfilerEnabled() {
  return mode.summaryEnabled
}

export function isPlaybackProfilerDetailEnabled() {
  return mode.summaryEnabled && mode.detailEnabled
}

export function beginSimulationTick(meta: PlaybackProfilerMeta) {
  return begin('simulation', meta)
}

export function endSimulationTick(context: PlaybackProfilerContext | null) {
  end(context)
}

export function beginRenderFrame(meta: PlaybackProfilerMeta) {
  return begin('render', meta)
}

export function endRenderFrame(context: PlaybackProfilerContext | null) {
  end(context)
}

export function measurePlaybackSpan<T>(context: PlaybackProfilerContext | null, name: string, fn: () => T): T {
  if (!context || !mode.summaryEnabled) return fn()
  const start = nowMs()
  try {
    return fn()
  } finally {
    context.spans[name] = (context.spans[name] ?? 0) + nowMs() - start
  }
}

export function addPlaybackCounter(context: PlaybackProfilerContext | null, name: string, value = 1) {
  if (!context || !mode.summaryEnabled) return
  context.counters[name] = (context.counters[name] ?? 0) + value
}

export function setPlaybackGauge(context: PlaybackProfilerContext | null, name: string, value: number) {
  if (!context || !mode.summaryEnabled) return
  context.gauges[name] = value
}

export function addActivePlaybackCounter(lane: PlaybackProfilerLane, name: string, value = 1) {
  addPlaybackCounter(activeContexts[lane] ?? null, name, value)
}

export function setActivePlaybackGauge(lane: PlaybackProfilerLane, name: string, value: number) {
  setPlaybackGauge(activeContexts[lane] ?? null, name, value)
}

export function measureActivePlaybackSpan<T>(lane: PlaybackProfilerLane, name: string, fn: () => T): T {
  return measurePlaybackSpan(activeContexts[lane] ?? null, name, fn)
}

export function recordPlaybackEvent(kind: string, payload: Record<string, number>) {
  if (!mode.detailEnabled) return
  slowEvents.unshift({
    lane: 'simulation',
    kind,
    durationMs: payload.durationMs ?? 0,
    currentUs: payload.currentUs ?? 0,
    progressRatio: payload.progressRatio ?? 0,
    topSpans: [],
    counters: cloneNumbers(payload),
  })
  while (slowEvents.length > SLOW_EVENT_LIMIT) slowEvents.pop()
  publishIfDue(true)
}
