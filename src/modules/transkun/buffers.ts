import { DEFAULT_PARAMS, type TranskunParams } from './params'

export interface TranskunBuffers {
  params: TranskunParams
  /** [rfftBins, nMels] row-major, index k*nMels + m. */
  freq2mels: Float32Array
  /** nWindows arrays of length windowSize (row 0 Hann, 1..5 learned Gaussian). */
  windows: Float32Array[]
  /** The 90 track symbols: [-64, -67, 21..108]. */
  symbols: Int32Array
  /** Precomputed nonzero rfft-bin range per mel filter (triangular filters are mostly zero). */
  melFirst: Int32Array
  melLast: Int32Array
}

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (HTTP ${res.status}). Check network connection or CORS.`)
  }
  return res.arrayBuffer()
}

export async function loadTranskunBuffers(baseUrl: string): Promise<TranskunBuffers> {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'

  const [paramsRes, freq2melsBuf, windowsBuf, symbolsBuf] = await Promise.all([
    fetch(base + 'params.json').then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch params.json (HTTP ${r.status}).`)
      return r.json()
    }),
    fetchBinary(base + 'freq2mels.f32'),
    fetchBinary(base + 'windows.f32'),
    fetchBinary(base + 'symbols.i32')
  ])

  const params: TranskunParams = { ...DEFAULT_PARAMS, ...paramsRes }

  const freq2mels = new Float32Array(freq2melsBuf)
  if (freq2mels.length !== params.rfftBins * params.nMels) {
    throw new Error(
      `freq2mels.f32 has ${freq2mels.length} elements, expected ${params.rfftBins * params.nMels}.`
    )
  }

  const flatWindows = new Float32Array(windowsBuf)
  const windows: Float32Array[] = []
  for (let w = 0; w < params.nWindows; w++) {
    windows.push(flatWindows.slice(w * params.windowSize, (w + 1) * params.windowSize))
  }

  const symbols = new Int32Array(symbolsBuf)

  // Each mel filter is triangular: exactly zero outside a small contiguous rfft-bin
  // range. Precomputing that range turns the dense 2049x229 mel matmul into a ~100x
  // cheaper sparse one — the hot loop of the whole front end.
  const nMels = params.nMels
  const rfftBins = params.rfftBins
  const melFirst = new Int32Array(nMels)
  const melLast = new Int32Array(nMels)
  for (let m = 0; m < nMels; m++) {
    let first = -1
    let last = -1
    for (let k = 0; k < rfftBins; k++) {
      if (freq2mels[k * nMels + m] !== 0) {
        if (first < 0) first = k
        last = k
      }
    }
    melFirst[m] = first < 0 ? 0 : first
    melLast[m] = last < 0 ? -1 : last
  }

  return { params, freq2mels, windows, symbols, melFirst, melLast }
}
