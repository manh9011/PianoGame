import * as ort from 'onnxruntime-web/webgpu'

// onnxruntime-web ships its own .wasm binaries; point at the matching CDN build
// so we don't have to fight Vite's asset pipeline over binary wasm files. This
// runs in the *user's* browser at demo time, so it needs no network access at
// build time.
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
// Cross-origin isolation (COOP/COEP) isn't guaranteed on every static host, so
// keep threading off — SIMD alone is still fast enough for this demo.
ort.env.wasm.numThreads = 1
ort.env.wasm.simd = true

/** Runs the exported Transkun transformer+scorer ONNX: featuresBatch -> (S, ctx). */
export class TranskunModel {
  private session: ort.InferenceSession | null = null
  private isWasmOnly = false

  constructor(private readonly url: string) {}

  async load(executionProviders: string[] = ['webgpu', 'wasm']): Promise<void> {
    this.session = await ort.InferenceSession.create(this.url, {
      executionProviders
    })
  }

  /**
   * Run the model on one segment's features ([nFrame, nMels, nWindows] flat row-major).
   * Returns S flat [T*T*90] (S[e,b,k] = result[(e*T+b)*90+k]) and ctx flat [90*T*256].
   */
  async run(
    features: Float32Array,
    nFrame: number,
    nMels: number,
    nWindows: number
  ): Promise<{ s: Float32Array; ctx: Float32Array; t: number }> {
    if (!this.session) throw new Error('TranskunModel has not been loaded yet. Call load() first.')
    const input = new ort.Tensor('float32', features, [1, nFrame, nMels, nWindows])
    try {
      const results = await this.session.run({ featuresBatch: input })
      const sTensor = results['S']
      const ctxTensor = results['ctx']
      const t = sTensor.dims[0]
      return { s: sTensor.data as Float32Array, ctx: ctxTensor.data as Float32Array, t }
    } catch (err: any) {
      if (!this.isWasmOnly && String(err).includes('WebGPU')) {
        console.warn('WebGPU execution failed for TranskunModel, falling back to WASM:', err)
        this.isWasmOnly = true
        await this.load(['wasm'])
        return this.run(features, nFrame, nMels, nWindows)
      }
      throw err
    }
  }
}

/** Runs the two Transkun attribute heads: attr [N,768] -> (velLogits [N,128], ofRaw [N,4]). */
export class TranskunHeadsModel {
  private session: ort.InferenceSession | null = null
  constructor(private readonly url: string) {}

  async load(executionProviders: string[] = ['webgpu', 'wasm']): Promise<void> {
    this.session = await ort.InferenceSession.create(this.url, {
      executionProviders
    })
  }

  async run(attr: Float32Array, n: number): Promise<{ velLogits: Float32Array; ofRaw: Float32Array }> {
    if (!this.session) throw new Error('TranskunHeadsModel has not been loaded yet. Call load() first.')
    if (n === 0) {
      return { velLogits: new Float32Array(0), ofRaw: new Float32Array(0) }
    }
    const input = new ort.Tensor('float32', attr, [n, 768])
    const results = await this.session.run({ attr: input })
    return {
      velLogits: results['velLogits'].data as Float32Array,
      ofRaw: results['ofRaw'].data as Float32Array
    }
  }
}
