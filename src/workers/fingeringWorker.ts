import { generatePianoFingering } from '../modules/fingering/pianoFingering'
import type { FingeringWorkerRequest, FingeringWorkerResponse } from '../modules/fingering/fingeringTypes'

self.onmessage = (event: MessageEvent<FingeringWorkerRequest>) => {
  const { id, notes, options } = event.data
  try {
    const result = generatePianoFingering(notes, options)
    self.postMessage({ id, result } satisfies FingeringWorkerResponse)
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies FingeringWorkerResponse)
  }
}
