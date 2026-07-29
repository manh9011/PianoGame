import { defineStore } from 'pinia'

export type RecordExportPreset = 'mp4-full' | 'webm-full' | 'mp4-10s' | 'webm-10s'
export type RecordExportStage = 'idle' | 'preparing' | 'audio' | 'video' | 'muxing' | 'done' | 'error'

export interface RecordExportProgress {
  stage: RecordExportStage
  percent: number
  message: string
}

function clampRange(startUs: number, endUs: number, durationUs: number) {
  const clampedStart = Math.max(0, Math.min(durationUs, startUs))
  const clampedEnd = Math.max(clampedStart, Math.min(durationUs, endUs))
  if (clampedEnd <= clampedStart) {
    return {
      startUs: 0,
      endUs: durationUs,
    }
  }
  return {
    startUs: clampedStart,
    endUs: clampedEnd,
  }
}

export const useRecordStore = defineStore('record', {
  state: () => ({
    cropStartUs: 0,
    cropEndUs: 0,
    exportPreset: 'mp4-full' as RecordExportPreset,
    exporting: false,
    exportProgress: {
      stage: 'idle',
      percent: 0,
      message: '',
    } as RecordExportProgress,
    lastExportError: '',
    abortController: null as AbortController | null,
  }),
  getters: {
    hasCropRange: state => state.cropEndUs > state.cropStartUs,
    cropDurationUs: state => Math.max(0, state.cropEndUs - state.cropStartUs),
  },
  actions: {
    initialize(durationUs: number) {
      const total = Math.max(0, durationUs)
      this.cropStartUs = 0
      this.cropEndUs = total
      this.exportPreset = 'mp4-full'
      this.exporting = false
      this.exportProgress = { stage: 'idle', percent: 0, message: '' }
      this.lastExportError = ''
    },
    setCropRange(startUs: number, endUs: number, durationUs: number) {
      const next = clampRange(startUs, endUs, durationUs)
      this.cropStartUs = next.startUs
      this.cropEndUs = next.endUs
    },
    setCropStart(startUs: number, durationUs: number) {
      this.setCropRange(startUs, this.cropEndUs || durationUs, durationUs)
    },
    setCropEnd(endUs: number, durationUs: number) {
      this.setCropRange(this.cropStartUs, endUs, durationUs)
    },
    resetCrop(durationUs: number) {
      const total = Math.max(0, durationUs)
      this.cropStartUs = 0
      this.cropEndUs = total
    },
    setExportPreset(preset: RecordExportPreset) {
      this.exportPreset = preset
    },
    startExport(message = '') {
      this.abortController?.abort()
      this.abortController = new AbortController()
      this.exporting = true
      this.lastExportError = ''
      this.exportProgress = { stage: 'preparing', percent: 0, message }
    },
    cancelExport() {
      this.abortController?.abort()
      this.abortController = null
      this.exporting = false
      this.exportProgress = { stage: 'idle', percent: 0, message: '' }
    },
    updateExportProgress(stage: RecordExportStage, percent: number, message = '') {
      this.exportProgress = {
        stage,
        percent: Math.max(0, Math.min(100, Math.round(percent))),
        message,
      }
    },
    finishExport(message = '') {
      this.exporting = false
      this.exportProgress = { stage: 'done', percent: 100, message }
    },
    failExport(message: string) {
      this.exporting = false
      this.lastExportError = message
      this.exportProgress = { stage: 'error', percent: 0, message }
    },
    clearExportState() {
      this.abortController?.abort()
      this.abortController = null
      this.exporting = false
      this.exportProgress = { stage: 'idle', percent: 0, message: '' }
      this.lastExportError = ''
    },
  },
})
