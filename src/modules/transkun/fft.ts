// Iterative radix-2 Cooley-Tukey FFT, unnormalized forward transform — a direct port of
// the reference implementation's Radix2Fft.Forward (AudioClaudio.Domain.Spectral). Input
// length must be a power of two. Only the forward transform is needed here (the mel front
// end never inverts).
//
// Reused scratch buffers across calls (re/im in, working arrays) so a per-frame,
// per-window FFT (thousands of calls per audio segment) doesn't churn the GC.
export class Radix2Fft {
  private readonly n: number
  private readonly reversedIndex: Int32Array
  private readonly cosTable: Float64Array[]
  private readonly sinTable: Float64Array[]
  readonly re: Float64Array
  readonly im: Float64Array

  constructor(n: number) {
    if (n <= 0 || (n & (n - 1)) !== 0) {
      throw new Error(`FFT length must be a positive power of two, got ${n}.`)
    }
    this.n = n
    this.re = new Float64Array(n)
    this.im = new Float64Array(n)

    // Precompute bit-reversal permutation.
    const rev = new Int32Array(n)
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1
      for (; (j & bit) !== 0; bit >>= 1) j ^= bit
      j ^= bit
      rev[i] = j
    }
    this.reversedIndex = rev

    // Precompute twiddle factors per stage.
    this.cosTable = []
    this.sinTable = []
    for (let len = 2; len <= n; len <<= 1) {
      const half = len / 2
      const cosT = new Float64Array(half)
      const sinT = new Float64Array(half)
      const ang = (-2.0 * Math.PI) / len
      for (let k = 0; k < half; k++) {
        cosT[k] = Math.cos(ang * k)
        sinT[k] = Math.sin(ang * k)
      }
      this.cosTable.push(cosT)
      this.sinTable.push(sinT)
    }
  }

  /** Forward FFT of a real-valued signal of length n. Result left in this.re / this.im. */
  forwardReal(samples: Float64Array | Float32Array): void {
    const n = this.n
    const re = this.re
    const im = this.im
    const rev = this.reversedIndex
    for (let i = 0; i < n; i++) {
      re[i] = samples[rev[i]]
      im[i] = 0
    }

    let stage = 0
    for (let len = 2; len <= n; len <<= 1, stage++) {
      const half = len / 2
      const cosT = this.cosTable[stage]
      const sinT = this.sinTable[stage]
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const wc = cosT[k]
          const ws = sinT[k]
          const uRe = re[i + k]
          const uIm = im[i + k]
          const vReRaw = re[i + k + half]
          const vImRaw = im[i + k + half]
          const vRe = vReRaw * wc - vImRaw * ws
          const vIm = vReRaw * ws + vImRaw * wc
          re[i + k] = uRe + vRe
          im[i + k] = uIm + vIm
          re[i + k + half] = uRe - vRe
          im[i + k + half] = uIm - vIm
        }
      }
    }
  }
}
