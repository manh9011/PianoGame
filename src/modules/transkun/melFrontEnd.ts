import type { TranskunBuffers } from './buffers'
import { Radix2Fft } from './fft'

/**
 * The Transkun mel front end (port of AudioClaudio's TranskunMelFrontEnd.cs): mono audio ->
 * featuresBatch [nFrame, nMels, nWindows], the exact input the exported ONNX expects.
 * Reproduces transkun's makeFrame -> per-segment gain-normalize -> six analysis windows ->
 * rfft(norm="ortho") -> power -> mel filterbank -> log-normalize.
 */
export class TranskunMelFrontEnd {
  private readonly buffers: TranskunBuffers
  private readonly fft: Radix2Fft
  private readonly win: number
  private readonly hop: number
  private readonly nMels: number
  private readonly nWindows: number
  private readonly rfftBins: number
  private readonly eps: number
  private readonly logEps: number

  constructor(buffers: TranskunBuffers) {
    this.buffers = buffers
    const p = buffers.params
    this.win = p.windowSize
    this.hop = p.hopSize
    this.nMels = p.nMels
    this.nWindows = p.nWindows
    this.rfftBins = p.rfftBins
    this.eps = p.eps
    this.logEps = Math.log(this.eps)
    this.fft = new Radix2Fft(this.win)
  }

  /** Compute featuresBatch [nFrame, nMels, nWindows] (row-major flat) for one segment of mono audio. */
  compute(audio: Float32Array): { features: Float32Array; nFrame: number } {
    const { win, hop, nMels, nWindows, rfftBins } = this
    const n = audio.length

    // (1) makeFrame: nFrame = ceil(n/hop)+1, half-window left pad, right pad to the last full frame.
    const nFrame = Math.ceil(n / hop) + 1
    const lPad = win >> 1
    const rPad = (nFrame - 1) * hop + (win >> 1) - n
    const padded = new Float64Array(lPad + n + rPad)
    for (let i = 0; i < n; i++) padded[lPad + i] = audio[i]

    // (2) gain normalization over ALL framed samples (with overlap), unbiased std.
    const count = nFrame * win
    let sum = 0.0
    for (let f = 0; f < nFrame; f++) {
      const b = f * hop
      for (let j = 0; j < win; j++) sum += padded[b + j]
    }
    const mean = sum / count
    let sqSum = 0.0
    for (let f = 0; f < nFrame; f++) {
      const b = f * hop
      for (let j = 0; j < win; j++) {
        const d = padded[b + j] - mean
        sqSum += d * d
      }
    }
    const std = Math.sqrt(sqSum / (count - 1)) // torch.std is unbiased by default
    const invStd = 1.0 / (std + 1e-8)

    // (3)-(5) per frame, per window: window -> ortho rfft -> power -> mel -> log-normalize.
    const features = new Float32Array(nFrame * nMels * nWindows)
    const orthoSq = 1.0 / win // |rfft(norm="ortho")|^2 = |rfft(raw)|^2 / N
    const invNegLogEps = 1.0 / -this.logEps
    const freq2mels = this.buffers.freq2mels
    const melFirst = this.buffers.melFirst
    const melLast = this.buffers.melLast
    const buf = new Float64Array(win)
    const power = new Float64Array(rfftBins)

    for (let f = 0; f < nFrame; f++) {
      const b = f * hop
      for (let w = 0; w < nWindows; w++) {
        const window = this.buffers.windows[w]
        for (let j = 0; j < win; j++) {
          buf[j] = (padded[b + j] - mean) * invStd * window[j]
        }

        this.fft.forwardReal(buf)
        const re = this.fft.re
        const im = this.fft.im
        for (let k = 0; k < rfftBins; k++) {
          power[k] = (re[k] * re[k] + im[k] * im[k]) * orthoSq
        }

        const rowBase = (f * nMels) * nWindows + w
        for (let m = 0; m < nMels; m++) {
          let acc = 0.0
          const last = melLast[m]
          const firstBin = melFirst[m]
          for (let k = firstBin; k <= last; k++) {
            acc += power[k] * freq2mels[k * nMels + m]
          }
          features[rowBase + m * nWindows] = (Math.log(acc + this.eps) - this.logEps) * invNegLogEps
        }
      }
    }

    return { features, nFrame }
  }
}
