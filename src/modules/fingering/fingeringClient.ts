import { generatePianoFingering } from './pianoFingering'
import type { FingeringInputNote, FingeringOptions, FingeringResult, FingeringWorkerRequest, FingeringWorkerResponse } from './fingeringTypes'

let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, { resolve: (result: FingeringResult) => void; reject: (error: Error) => void }>()

function supportsWorker() {
  return typeof Worker !== 'undefined'
}

function getWorker() {
  if (!supportsWorker()) return null
  if (!worker) {
    worker = new Worker(new URL('../../workers/fingeringWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<FingeringWorkerResponse>) => {
      const entry = pending.get(event.data.id)
      if (!entry) return
      pending.delete(event.data.id)
      if (event.data.error) entry.reject(new Error(event.data.error))
      else if (event.data.result) entry.resolve(event.data.result)
      else entry.reject(new Error('Fingering worker returned no result'))
    }
    worker.onerror = event => {
      const error = new Error(event.message || 'Fingering worker failed')
      for (const entry of pending.values()) entry.reject(error)
      pending.clear()
      disposeFingeringWorker()
    }
  }
  return worker
}

export function disposeFingeringWorker() {
  worker?.terminate()
  worker = null
}

export function requestPianoFingering(notes: FingeringInputNote[], options: FingeringOptions = {}): Promise<FingeringResult> {
  const activeWorker = getWorker()
  if (!activeWorker) return Promise.resolve(generatePianoFingering(notes, options))

  const id = nextRequestId++
  const message: FingeringWorkerRequest = { id, notes, options }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    activeWorker.postMessage(message)
  })
}
