/// <reference lib="webworker" />

import type { RenderExportErrorMessage, RenderExportProgressMessage, RenderExportReadyMessage, RenderExportRequest, RenderExportResultMessage } from '../modules/renderExport/exportTypes'

declare const self: DedicatedWorkerGlobalScope

function postReady() {
  const payload: RenderExportReadyMessage = { type: 'ready' }
  self.postMessage(payload)
}

function postProgress(requestId: number, stage: RenderExportProgressMessage['stage'], percent: number, message: string) {
  const payload: RenderExportProgressMessage = { type: 'progress', requestId, stage, percent, message }
  self.postMessage(payload)
}

function formatWorkerError(error: unknown) {
  if (!(error instanceof Error)) return String(error)
  return error.stack ? `${error.name}: ${error.message}\n${error.stack}` : `${error.name}: ${error.message}`
}

async function handleRender(request: RenderExportRequest) {
  const { renderVideoExport } = await import('../modules/renderExport/videoEncoder')
  const result = await renderVideoExport(request, (stage, percent, message) => {
    postProgress(request.requestId, stage, percent, message)
  })

  const payload: RenderExportResultMessage = {
    type: 'result',
    requestId: request.requestId,
    mimeType: result.mimeType,
    fileName: result.fileName,
    data: result.data,
  }
  self.postMessage(payload, [result.data])
}

postReady()

self.onmessage = event => {
  const request = event.data as RenderExportRequest
  if (request.type !== 'render-export') return

  handleRender(request).catch(error => {
    const payload: RenderExportErrorMessage = {
      type: 'error',
      requestId: request.requestId,
      message: formatWorkerError(error),
    }
    self.postMessage(payload)
  })
}
