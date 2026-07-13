export function createSpriteCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width))
  canvas.height = Math.max(1, Math.ceil(height))
  return canvas
}

export class CanvasSpriteCache {
  private readonly sprites = new Map<string, HTMLCanvasElement>()

  constructor(private readonly maxEntries = 512) {}

  getOrCreate(key: string, factory: () => HTMLCanvasElement) {
    const cached = this.sprites.get(key)
    if (cached) {
      this.sprites.delete(key)
      this.sprites.set(key, cached)
      return cached
    }
    const sprite = factory()
    this.sprites.set(key, sprite)
    while (this.sprites.size > this.maxEntries) {
      const oldestKey = this.sprites.keys().next().value
      if (oldestKey === undefined) break
      this.sprites.delete(oldestKey)
    }
    return sprite
  }

  clear() {
    this.sprites.clear()
  }
}
