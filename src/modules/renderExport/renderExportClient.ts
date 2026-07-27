import { loadRenderAssetBlob } from '../storage/renderAssetStore'
import type { RecordExportPreset } from '../../stores/recordStore'
import type { RecordRenderScene, RecordRenderVisualOptions } from '../render/record/recordRenderModel'
import { packOfflineAudio } from './offlineAudioRenderer'
import { renderOfflineAudio } from './soundfontRenderer'
import type {
  RenderAssetPayload,
  RenderExportProgressMessage,
  RenderExportRequest,
  RenderExportResultMessage,
  RenderExportWorkerMessage,
} from './exportTypes'

let nextRequestId = 1

async function loadAssetPayload(assetId: string): Promise<RenderAssetPayload | null> {
  if (!assetId) return null
  const blob = await loadRenderAssetBlob(assetId)
  if (!blob) return null
  return {
    data: await blob.arrayBuffer(),
    type: blob.type || 'application/octet-stream',
  }
}

export interface RenderExportJobOptions {
  preset: RecordExportPreset
  scene: RecordRenderScene
  visuals: RecordRenderVisualOptions
  cropStartUs: number
  cropEndUs: number
  outputVolume: number
  backgroundAssetId?: string
  logoAssetId?: string
  onProgress?: (message: RenderExportProgressMessage) => void
}

function cloneScene(scene: RecordRenderScene): RecordRenderScene {
  return {
    notes: scene.notes.map(note => ({ ...note })),
    tracks: scene.tracks.map(track => ({ ...track })),
    measureGridUs: [...scene.measureGridUs],
    keySignatures: scene.keySignatures.map(signature => ({ ...signature })),
    durationUs: scene.durationUs,
    keyboardRange: {
      lowNote: scene.keyboardRange.lowNote,
      highNote: scene.keyboardRange.highNote,
    },
    showDuration: scene.showDuration,
    speed: scene.speed,
    title: scene.title,
  }
}

function cloneVisuals(visuals: RecordRenderVisualOptions): RecordRenderVisualOptions {
  return {
    showGrid: visuals.showGrid,
    showFallingNotes: visuals.showFallingNotes,
    showKeyboard: visuals.showKeyboard,
    showKeyLabels: visuals.showKeyLabels,
    showNoteLabels: visuals.showNoteLabels,
    showFingerHints: visuals.showFingerHints,
    showColoredFingerHints: visuals.showColoredFingerHints,
    keyLabelMode: visuals.keyLabelMode,
    noteLabelMode: visuals.noteLabelMode,
    keyLabelSize: visuals.keyLabelSize,
    noteLabelSize: visuals.noteLabelSize,
    orientation: visuals.orientation,
    videoSize: visuals.videoSize,
    backgroundOpacity: visuals.backgroundOpacity,
    logoEnabled: visuals.logoEnabled,
  }
}

function getWorker() {
  return new Worker(new URL('../../workers/renderExportWorker.ts', import.meta.url), { type: 'module' })
}

function waitForWorkerReady(worker: Worker) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', handleReady)
      worker.removeEventListener('error', handleReadyError)
    }

    const handleReady = (event: MessageEvent<RenderExportWorkerMessage>) => {
      if (event.data.type !== 'ready') return
      cleanup()
      resolve()
    }

    const handleReadyError = (event: ErrorEvent | Event) => {
      cleanup()
      if (event instanceof ErrorEvent && event.error instanceof Error) {
        reject(event.error)
        return
      }
      const errorEvent = event as ErrorEvent
      const location = errorEvent.filename ? ` (${errorEvent.filename}:${errorEvent.lineno}:${errorEvent.colno})` : ''
      const msg = errorEvent.message || 'Worker failed to load or encountered an error (check browser console)'
      reject(new Error(`${msg}${location}`))
    }

    worker.addEventListener('message', handleReady)
    worker.addEventListener('error', handleReadyError)
  })
}

export function renderExportJob(options: RenderExportJobOptions): Promise<RenderExportResultMessage> {
  const requestId = nextRequestId++
  return new Promise<RenderExportResultMessage>(async (resolve, reject) => {
    let exportWorker: Worker | null = null

    const cleanup = () => {
      if (exportWorker) {
        exportWorker.removeEventListener('message', handleMessage)
        exportWorker.removeEventListener('error', handleError)
        exportWorker.terminate()
        exportWorker = null
      }
    }

    const handleError = (event: ErrorEvent | Event) => {
      cleanup()
      if (event instanceof ErrorEvent && event.error instanceof Error) {
        reject(event.error)
        return
      }
      const errorEvent = event as ErrorEvent
      const location = errorEvent.filename ? ` (${errorEvent.filename}:${errorEvent.lineno}:${errorEvent.colno})` : ''
      const msg = errorEvent.message || 'Worker failed to load or encountered an error (check browser console)'
      reject(new Error(`${msg}${location}`))
    }

    const handleMessage = (event: MessageEvent<RenderExportWorkerMessage>) => {
      const message = event.data
      if (message.type === 'ready' || message.requestId !== requestId) return
      if (message.type === 'progress') {
        options.onProgress?.(message)
        return
      }
      cleanup()
      if (message.type === 'result') resolve(message)
      else reject(new Error(message.message))
    }

    try {
      options.onProgress?.({
        type: 'progress',
        requestId,
        stage: 'preparing',
        percent: 5,
        message: 'Preparing assets...',
      })

      const request: RenderExportRequest = {
        type: 'render-export',
        requestId,
        preset: options.preset,
        scene: cloneScene(options.scene),
        visuals: cloneVisuals(options.visuals),
        cropStartUs: options.cropStartUs,
        cropEndUs: options.cropEndUs,
        outputVolume: options.outputVolume,
        background: await loadAssetPayload(options.backgroundAssetId ?? ''),
        logo: await loadAssetPayload(options.logoAssetId ?? ''),
        audio: null,
      }

      options.onProgress?.({
        type: 'progress',
        requestId,
        stage: 'audio',
        percent: 12,
        message: 'Rendering audio...',
      })

      request.audio = packOfflineAudio(await renderOfflineAudio(request, {
        onProgress: progress => options.onProgress?.({
          type: 'progress',
          requestId,
          stage: 'audio',
          percent: 12 + Math.round(progress * 36),
          message: 'Rendering audio...',
        }),
      }))

      exportWorker = getWorker()
      await waitForWorkerReady(exportWorker)
      exportWorker.addEventListener('message', handleMessage)
      exportWorker.addEventListener('error', handleError)

      const transfers: Transferable[] = []
      if (request.background?.data) transfers.push(request.background.data)
      if (request.logo?.data) transfers.push(request.logo.data)
      for (const channel of request.audio?.channels ?? []) transfers.push(channel)

      exportWorker.postMessage(request, transfers)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
