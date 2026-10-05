import { SheetMusicError } from './sheetTypes'
import type { SheetErrorCode, SheetGenerationProgress, SheetMusicArtifact, SheetMessageValues, SheetProgressCode } from './sheetTypes'

interface WorkerProgressMessage {
  type: 'progress'
  requestId: number
  stage: SheetGenerationProgress['stage']
  message: string
  code?: SheetProgressCode
  values?: SheetMessageValues
}

interface WorkerResultMessage {
  type: 'result'
  requestId: number
  artifact: SheetMusicArtifact
}

interface WorkerErrorMessage {
  type: 'error'
  requestId: number
  message: string
  code?: SheetErrorCode
  values?: SheetMessageValues
}

type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage

const artifactCache = new Map<string, SheetMusicArtifact>()
let worker: Worker | null = null
let nextRequestId = 1

function getWorker() {
  worker ??= new Worker(new URL('../../workers/sheetMusicWorker.ts', import.meta.url), { type: 'module' })
  return worker
}

export function clearSheetMusicCache() {
  artifactCache.clear()
}

export interface GenerateSheetMusicOptions {
  includedTrackIds?: number[]
}

export function generateSheetMusic(
  cacheKey: string,
  buffer: ArrayBuffer,
  onProgress?: (progress: SheetGenerationProgress) => void,
  options: GenerateSheetMusicOptions = {},
) {
  const cached = artifactCache.get(cacheKey)
  if (cached) {
    onProgress?.({ stage: 'ready', message: 'sheetMusic.progress.cacheReady', code: 'cacheReady' })
    return Promise.resolve(cached)
  }

  const requestId = nextRequestId++
  const sheetWorker = getWorker()

  return new Promise<SheetMusicArtifact>((resolve, reject) => {
    const cleanup = () => {
      sheetWorker.removeEventListener('message', handleMessage)
      sheetWorker.removeEventListener('error', handleError)
    }

    const handleError = (event: ErrorEvent) => {
      cleanup()
      reject(event.error instanceof Error ? event.error : new SheetMusicError(event.message, 'generationFailed'))
    }

    const handleMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      if (message.requestId !== requestId) return

      if (message.type === 'progress') {
        onProgress?.({ stage: message.stage, message: message.message, code: message.code, values: message.values })
        return
      }

      cleanup()
      if (message.type === 'result') {
        artifactCache.set(cacheKey, message.artifact)
        onProgress?.({ stage: 'ready', message: 'sheetMusic.progress.ready', code: 'ready' })
        resolve(message.artifact)
      } else {
        reject(new SheetMusicError(message.message, message.code ?? 'generationFailed', message.values))
      }
    }

    sheetWorker.addEventListener('message', handleMessage)
    sheetWorker.addEventListener('error', handleError)
    onProgress?.({ stage: 'building-model', message: 'sheetMusic.progress.preparingData', code: 'preparingData' })
    sheetWorker.postMessage({ type: 'generate', requestId, cacheKey, buffer, includedTrackIds: options.includedTrackIds }, [buffer])
  })
}
