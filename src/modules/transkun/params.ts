// Frozen Transkun front-end parameters — mirrors params.json shipped in
// TuesdayCrowd/transkun-onnx. Fetched at runtime (see buffers.ts) so this file
// only holds the well-known defaults / fallbacks and the constants that are
// baked into the exported ONNX graphs themselves (never change without a
// re-export).
export interface TranskunParams {
  fs: number
  windowSize: number
  hopSize: number
  nMels: number
  nWindows: number
  eps: number
  fMin: number
  fMax: number
  rfftBins: number
  segmentSizeSeconds: number
  segmentHopSeconds: number
  nSymbols: number
}

export const DEFAULT_PARAMS: TranskunParams = {
  fs: 44100,
  windowSize: 4096,
  hopSize: 1024,
  nMels: 229,
  nWindows: 6,
  eps: 1e-5,
  fMin: 30.0,
  fMax: 8000.0,
  rfftBins: 2049,
  segmentSizeSeconds: 16.0,
  segmentHopSeconds: 8.0,
  nSymbols: 90
}

// ctx feature dim from the ONNX backbone: baseSize(64) * scoringExpansionFactor(4).
export const CTX_DIM = 256
// attr row fed to the heads model: [ctx_a, ctx_b, ctx_a·ctx_b].
export const ATTR_DIM = 3 * CTX_DIM
export const VELOCITY_CLASSES = 128
// track 0 of the 90-symbol map is the sustain pedal (MIDI CC64); track 1 is
// the soft pedal (CC67, decoded but not emitted — matches the reference).
export const SUSTAIN_SYMBOL = -64
export const SOFT_SYMBOL = -67
