export function createSpriteCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width))
  canvas.height = Math.max(1, Math.ceil(height))
  return canvas
}

export class CanvasSpriteCache {
  private readonly sprites = new Map<string, HTMLCanvasElement>()
  private hits = 0
  private misses = 0
  private evictions = 0
  private clears = 0

  constructor(private readonly maxEntries = 512) {}

  getOrCreate(key: string, factory: () => HTMLCanvasElement) {
    const cached = this.sprites.get(key)
    if (cached) {
      this.hits += 1
      this.sprites.delete(key)
      this.sprites.set(key, cached)
      return cached
    }
    this.misses += 1
    const sprite = factory()
    this.sprites.set(key, sprite)
    while (this.sprites.size > this.maxEntries) {
      const oldestKey = this.sprites.keys().next().value
      if (oldestKey === undefined) break
      this.sprites.delete(oldestKey)
      this.evictions += 1
    }
    return sprite
  }

  snapshotStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      clears: this.clears,
      size: this.sprites.size,
    }
  }

  resetStats() {
    this.hits = 0
    this.misses = 0
    this.evictions = 0
    this.clears = 0
  }

  clear() {
    this.sprites.clear()
    this.clears += 1
  }
}
