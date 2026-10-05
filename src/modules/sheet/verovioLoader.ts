import { SheetMusicError } from './sheetTypes'

interface VerovioToolkit {
  setOptions(options: Record<string, unknown>): void
  loadData(data: string): void
  loadZipDataBase64(data: string): void
  renderToMIDI(): string
  renderToSVG(page: number, options?: Record<string, unknown>): string
  getElementsAtTime(milliseconds: number): { page?: number; notes?: string[] }
  getTimeForElement(id: string): number
}

interface VerovioModuleRuntime {
  onRuntimeInitialized?: (() => void) | Promise<void>
  calledRun?: boolean
  getToolkit?: () => unknown
}

interface VerovioModule {
  module: VerovioModuleRuntime
  toolkit: new () => VerovioToolkit
}

declare global {
  interface Window {
    verovio?: VerovioModule
  }
}

let verovioPromise: Promise<VerovioModule> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (window.verovio) resolve()
      else existing.addEventListener('load', () => resolve(), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new SheetMusicError('sheetMusic.errors.verovioLoadFailed', 'verovioLoadFailed'))
    document.head.appendChild(script)
  })
}

function waitForRuntime(verovio: VerovioModule) {
  if (verovio.module.calledRun || typeof verovio.module.getToolkit === 'function') {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new SheetMusicError('sheetMusic.errors.verovioInitTimeout', 'verovioInitTimeout'))
    }, 30_000)

    const finish = () => {
      window.clearTimeout(timeout)
      resolve()
    }

    const current = verovio.module.onRuntimeInitialized
    if (current && typeof (current as Promise<void>).then === 'function') {
      void (current as Promise<void>).then(finish, reject)
      return
    }

    verovio.module.onRuntimeInitialized = () => {
      if (typeof current === 'function') current()
      finish()
    }
  })
}

export async function loadVerovio() {
  if (!verovioPromise) {
    verovioPromise = (async () => {
      await loadScript('https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js')
      if (!window.verovio) throw new SheetMusicError('sheetMusic.errors.verovioUnavailable', 'verovioUnavailable')
      await waitForRuntime(window.verovio)
      return window.verovio
    })().catch(error => {
      verovioPromise = null
      throw error
    })
  }
  return verovioPromise
}
