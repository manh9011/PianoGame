export interface MetronomeBeat {
  timeUs: number
  firstBeat: boolean
}

export interface MetronomeOptions {
  volume: number
  doubleSpeed: boolean
  emphasizeFirstBeat: boolean
}

interface TickPoint {
  timeUs: number
  firstBeat: boolean
}

const MAX_CATCH_UP_US = 250_000

export class MetronomePlayer {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private beatGrid: MetronomeBeat[] | null = null
  private doubleSpeed = false
  private ticks: TickPoint[] = []
  private cursor = 0
  private lastCurrentUs: number | null = null

  tick(beatGrid: MetronomeBeat[], currentUs: number, options: MetronomeOptions) {
    this.ensureTicks(beatGrid, options.doubleSpeed)

    if (!this.ticks.length) return

    if (this.lastCurrentUs !== null && currentUs < this.lastCurrentUs) {
      this.cursor = this.firstTickAfter(currentUs)
    }

    if (options.volume <= 0) {
      this.cursor = this.firstTickAfter(currentUs)
      this.lastCurrentUs = currentUs
      return
    }

    if (this.lastCurrentUs !== null && currentUs - this.lastCurrentUs > MAX_CATCH_UP_US) {
      this.cursor = this.firstTickAfter(currentUs)
      this.lastCurrentUs = currentUs
      return
    }

    let played = 0
    while (this.cursor < this.ticks.length && this.ticks[this.cursor].timeUs <= currentUs) {
      const tick = this.ticks[this.cursor]
      if (this.lastCurrentUs === null || tick.timeUs >= this.lastCurrentUs - 1_000) {
        this.play(options.volume, tick.firstBeat && options.emphasizeFirstBeat)
        played += 1
      }
      this.cursor += 1
      if (played >= 2) {
        this.cursor = this.firstTickAfter(currentUs)
        break
      }
    }

    this.lastCurrentUs = currentUs
  }

  reset(currentUs: number) {
    this.cursor = this.firstTickAfter(currentUs)
    this.lastCurrentUs = currentUs
  }

  restart() {
    this.cursor = 0
    this.lastCurrentUs = null
  }

  resumeAudioContext() {
    const context = this.ensureContext()
    if (context.state === 'suspended') void context.resume()
  }

  private ensureTicks(beatGrid: MetronomeBeat[], doubleSpeed: boolean) {
    if (this.beatGrid === beatGrid && this.doubleSpeed === doubleSpeed) return
    this.beatGrid = beatGrid
    this.doubleSpeed = doubleSpeed
    this.ticks = this.buildTicks(beatGrid, doubleSpeed)
    this.cursor = this.lastCurrentUs === null ? 0 : this.firstTickAfter(this.lastCurrentUs)
  }

  private buildTicks(beatGrid: MetronomeBeat[], doubleSpeed: boolean) {
    const ticks: TickPoint[] = []
    for (let index = 0; index < beatGrid.length; index += 1) {
      const beat = beatGrid[index]
      ticks.push({ timeUs: beat.timeUs, firstBeat: beat.firstBeat })

      const next = beatGrid[index + 1]
      if (doubleSpeed && next && next.timeUs > beat.timeUs) {
        ticks.push({ timeUs: Math.round((beat.timeUs + next.timeUs) / 2), firstBeat: false })
      }
    }

    return ticks
      .sort((a, b) => a.timeUs - b.timeUs)
      .filter((tick, index, all) => index === 0 || tick.timeUs !== all[index - 1].timeUs)
  }

  private firstTickAfter(currentUs: number) {
    let low = 0
    let high = this.ticks.length
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (this.ticks[mid].timeUs <= currentUs) low = mid + 1
      else high = mid
    }
    return low
  }

  private play(volume: number, accented: boolean) {
    const context = this.ensureContext()
    if (!context || !this.master) return
    if (context.state === 'suspended') void context.resume()

    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const normalizedVolume = Math.max(0, Math.min(1, volume / 100))
    const peak = normalizedVolume * (accented ? 0.55 : 0.35)

    oscillator.type = accented ? 'triangle' : 'square'
    oscillator.frequency.setValueAtTime(accented ? 780 : 1450, now)
    oscillator.frequency.exponentialRampToValueAtTime(accented ? 520 : 1150, now + 0.035)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (accented ? 0.075 : 0.045))

    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start(now)
    oscillator.stop(now + (accented ? 0.08 : 0.05))
  }

  private ensureContext() {
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = 1
      this.master.connect(this.context.destination)
    }
    return this.context
  }
}
