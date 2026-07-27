import type { RecordRenderScene, RecordRenderVisualOptions } from '../render/record/recordRenderModel'
import type { RecordExportPreset, RecordExportStage } from '../../stores/recordStore'

export interface RenderAssetPayload {
  data: ArrayBuffer
  type: string
}

export interface RenderedAudioPayload {
  sampleRate: number
  length: number
  numberOfChannels: number
  channels: ArrayBuffer[]
}

export interface RenderExportRequest {
  type: 'render-export'
  requestId: number
  preset: RecordExportPreset
  scene: RecordRenderScene
  visuals: RecordRenderVisualOptions
  cropStartUs: number
  cropEndUs: number
  outputVolume: number
  background?: RenderAssetPayload | null
  logo?: RenderAssetPayload | null
  audio?: RenderedAudioPayload | null
}

export interface RenderExportReadyMessage {
  type: 'ready'
}

export interface RenderExportProgressMessage {
  type: 'progress'
  requestId: number
  stage: RecordExportStage
  percent: number
  message: string
}

export interface RenderExportResultMessage {
  type: 'result'
  requestId: number
  mimeType: string
  fileName: string
  data: ArrayBuffer
}

export interface RenderExportErrorMessage {
  type: 'error'
  requestId: number
  message: string
}

export type RenderExportWorkerMessage = RenderExportReadyMessage | RenderExportProgressMessage | RenderExportResultMessage | RenderExportErrorMessage
