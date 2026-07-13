export interface PlayerClockState { currentUs: number; progress: number; running: boolean; finished: boolean; looped?: boolean }
export interface MidiPlayerClockOptions { leadInUs?: number; leadOutUs?: number }
export const LEAD_IN_US = 5_500_000
export const LEAD_OUT_US = 1_000_000
const HIDDEN_TICK_MS = 50

export class MidiPlayerClock {
  private startMs = 0
  private pauseUs: number
  private raf: number | null = null
  private timeout: number | null = null
  private visibilityListenerAttached = false
  private loopStartUs: number | null = null
  private loopEndUs: number | null = null
  private loopDelayMs = 0
  private delayEndMs: number | null = null
  private leadInUs: number
  private leadOutUs: number
  state: PlayerClockState

  constructor(private durationUs: number, private speed: () => number, private onTick: (state: PlayerClockState) => void, options: MidiPlayerClockOptions = {}) {
    this.leadInUs = options.leadInUs ?? LEAD_IN_US
    this.leadOutUs = options.leadOutUs ?? LEAD_OUT_US
    this.pauseUs = -this.leadInUs
    this.state = { currentUs: -this.leadInUs, progress: 0, running: false, finished: false }
  }

  get seekableDurationUs() { return this.durationUs + this.leadOutUs }
  setLoopBounds(startUs: number | null, endUs: number | null, delayMs = 0) {
    this.loopStartUs = startUs
    this.loopEndUs = endUs
    this.loopDelayMs = delayMs
  }
  start() {
    if (this.state.running) return
    this.startMs = performance.now()
    this.state.running = true
    this.attachVisibilityListener()
    this.loop()
  }
  pause() {
    if (!this.state.running) return
    this.cancelScheduled()
    this.pauseUs = this.state.currentUs
    this.state.running = false
    this.delayEndMs = null
    this.detachVisibilityListener()
    this.onTick(this.state)
  }
  toggle() { this.state.running ? this.pause() : this.start() }
  stop() {
    this.cancelScheduled()
    this.detachVisibilityListener()
    this.state = { currentUs: -this.leadInUs, progress: 0, running: false, finished: false }
    this.pauseUs = -this.leadInUs
    this.delayEndMs = null
  }
  setSpeed() { if (this.state.running) { this.pauseUs = this.state.currentUs; this.startMs = performance.now() } }
  seek(currentUs: number) {
    const wasRunning = this.state.running
    if (wasRunning) this.cancelScheduled()
    const current = this.clampCurrentUs(currentUs)
    const finished = current >= this.seekableDurationUs
    this.pauseUs = current
    this.startMs = performance.now()
    this.delayEndMs = null
    this.state = { currentUs: current, progress: this.progressFor(current), running: wasRunning && !finished, finished }
    this.onTick(this.state)
    if (wasRunning && !finished) {
      this.attachVisibilityListener()
      this.scheduleNext()
    } else {
      this.detachVisibilityListener()
    }
  }
  private clampCurrentUs(currentUs: number) { return Math.max(-this.leadInUs, Math.min(this.seekableDurationUs, currentUs)) }
  private progressFor(currentUs: number) { return Math.max(0, Math.min(1, currentUs / this.seekableDurationUs)) }
  private loop = () => {
    this.raf = null
    this.timeout = null
    const now = performance.now()
    let looped = false
    if (this.delayEndMs !== null) {
      if (now >= this.delayEndMs) {
        this.delayEndMs = null
        this.pauseUs = this.loopStartUs ?? 0
        this.startMs = now
        looped = true
      } else {
        this.scheduleNext()
        return
      }
    }
    const elapsedUs = (now - this.startMs) * 1000 * (this.speed() / 100)
    let currentUs = this.pauseUs + elapsedUs
    if (this.loopEndUs !== null && currentUs >= this.loopEndUs) {
      if (this.loopDelayMs > 0) {
        this.delayEndMs = now + this.loopDelayMs
        currentUs = this.loopEndUs
        this.pauseUs = currentUs
        this.startMs = now
        this.state = { currentUs, progress: this.progressFor(currentUs), running: true, finished: false }
        this.onTick(this.state)
        this.scheduleNext()
        return
      } else {
        this.pauseUs = this.loopStartUs ?? 0
        this.startMs = now
        currentUs = this.pauseUs
        looped = true
      }
    }
    const finished = currentUs >= this.seekableDurationUs
    this.state = { currentUs, progress: this.progressFor(currentUs), running: true, finished, looped }
    this.onTick(this.state)
    if (finished) this.pause()
    else this.scheduleNext()
  }
  private scheduleNext() {
    if (!this.state.running) return
    if (this.shouldUseTimeout()) {
      this.timeout = setTimeout(this.loop, this.nextTimeoutDelayMs())
      return
    }
    this.raf = requestAnimationFrame(this.loop)
  }
  private cancelScheduled() {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
    if (this.timeout !== null) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }
  private shouldUseTimeout() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden'
  }
  private nextTimeoutDelayMs() {
    if (this.delayEndMs === null) return HIDDEN_TICK_MS
    return Math.max(0, Math.min(HIDDEN_TICK_MS, this.delayEndMs - performance.now()))
  }
  private onVisibilityChange = () => {
    if (!this.state.running) return
    this.cancelScheduled()
    this.scheduleNext()
  }
  private attachVisibilityListener() {
    if (this.visibilityListenerAttached || typeof document === 'undefined') return
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.visibilityListenerAttached = true
  }
  private detachVisibilityListener() {
    if (!this.visibilityListenerAttached || typeof document === 'undefined') return
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.visibilityListenerAttached = false
  }
}
