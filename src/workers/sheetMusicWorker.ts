/// <reference lib="webworker" />

import { createSheetSource, filterSheetSourceTracks } from '../modules/sheet/sheetSource'
import { createVoicePlans } from '../modules/sheet/voiceStaffPartition'
import { serializeVoiceShard } from '../modules/sheet/midiShardSerializer'
import { mergeShardMusicXml } from '../modules/sheet/musicXmlMerge'
import { SheetMusicError, toSheetMusicError } from '../modules/sheet/sheetTypes'
import type { SheetErrorCode, SheetGenerationStage, SheetMusicArtifact, SheetMessageValues, SheetProgressCode } from '../modules/sheet/sheetTypes'
import WebMscore from 'webmscore'
import { loadSettings } from '../modules/settings/userSettings'

declare const self: DedicatedWorkerGlobalScope

type PyodideRuntime = {
  loadPackage(packages: string[]): Promise<void>
  pyimport(name: string): { install(packageName: string): Promise<void> }
  FS: {
    writeFile(path: string, data: Uint8Array): void
    unlink(path: string): void
  }
  runPythonAsync<T = unknown>(code: string): Promise<T>
}

type LoadPyodide = (options?: { indexURL?: string }) => Promise<PyodideRuntime>

interface SheetWorkerRequest {
  type: 'generate'
  requestId: number
  cacheKey: string
  buffer: ArrayBuffer
  includedTrackIds?: number[]
}

interface SheetWorkerProgress {
  type: 'progress'
  requestId: number
  stage: SheetGenerationStage
  message: string
  code?: SheetProgressCode
  values?: SheetMessageValues
}

interface SheetWorkerResult {
  type: 'result'
  requestId: number
  artifact: SheetMusicArtifact
}

interface SheetWorkerError {
  type: 'error'
  requestId: number
  message: string
  code?: SheetErrorCode
  values?: SheetMessageValues
}

let pyodidePromise: Promise<PyodideRuntime> | null = null
let music21Ready: Promise<void> | null = null

function postProgress(
  requestId: number,
  stage: SheetGenerationStage,
  message: string,
  code: SheetProgressCode,
  values?: SheetMessageValues,
) {
  const payload: SheetWorkerProgress = { type: 'progress', requestId, stage, message, code, values }
  self.postMessage(payload)
}

async function ensurePyodide(requestId: number) {
  if (!pyodidePromise) {
    postProgress(requestId, 'loading-pyodide', 'sheetMusic.progress.loadingPyodide', 'loadingPyodide')
    const pyodideUrl = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs'
    const pyodideModule = await import(/* @vite-ignore */ pyodideUrl) as unknown as { loadPyodide: LoadPyodide }
    pyodidePromise = pyodideModule.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' })
  }

  const pyodide = await pyodidePromise
  if (!music21Ready) {
    music21Ready = (async () => {
      postProgress(requestId, 'installing-music21', 'sheetMusic.progress.installingMusic21', 'installingMusic21')
      await pyodide.loadPackage(['micropip', 'numpy'])
      const micropip = pyodide.pyimport('micropip')
      await micropip.install('music21')
    })()
  }
  await music21Ready
  return pyodide
}

const SHARD_TO_MUSICXML = String.raw`
from music21 import converter, tempo
from music21.musicxml.m21ToXml import GeneralObjectExporter

score = converter.parse(shard_path)
for mark in list(score.recurse().getElementsByClass(tempo.MetronomeMark)):
    try:
        mark.style.hideObjectOnPrint = True
    except Exception:
        pass
xml_bytes = GeneralObjectExporter(score).parse()
xml_bytes.decode('utf-8')
`

function cleanupFile(pyodide: PyodideRuntime, path: string) {
  try {
    pyodide.FS.unlink(path)
  } catch {
    // File tạm có thể đã được Pyodide dọn, bỏ qua.
  }
}

async function convertShard(pyodide: PyodideRuntime, path: string, bytes: Uint8Array) {
  pyodide.FS.writeFile(path, bytes)
  try {
    return String(await pyodide.runPythonAsync(SHARD_TO_MUSICXML.replace('shard_path', JSON.stringify(path))))
  } finally {
    cleanupFile(pyodide, path)
  }
}

async function handleGenerate(request: SheetWorkerRequest) {
  const { requestId, cacheKey, buffer } = request

  postProgress(requestId, 'building-model', 'sheetMusic.progress.analyzingMidi', 'analyzingMidi')
  const source = filterSheetSourceTracks(createSheetSource(buffer), request.includedTrackIds)
  const plans = createVoicePlans(source)
  if (!plans.length) throw new SheetMusicError('sheetMusic.errors.noVoices', 'noVoices')

  const artifactStats = {
    staffCount: new Set(plans.map(plan => plan.staff)).size,
    voiceCount: plans.length,
    noteCount: plans.reduce((sum, plan) => sum + plan.events.reduce((eventSum, event) => eventSum + event.pitches.length, 0), 0),
  }

  // Polyfill `document` for webmscore if it's missing in WebWorker
  if (typeof (self as any).document === 'undefined') {
    ;(self as any).document = {
      baseURI: self.location?.href || '',
      createElement: () => ({}),
    }
  }

  const settings = await loadSettings()
  let useFallback = false

  if (settings.advancedConverterMidiToMusicXml === 'webmscore') {
    try {
      await WebMscore.ready
      const bytesCopy = new Uint8Array(buffer.byteLength)
      bytesCopy.set(new Uint8Array(buffer))
      const score = await WebMscore.load('midi', bytesCopy, [], false)
      const musicXml = await score.saveXml()
      score.destroy()
      
      const artifact: SheetMusicArtifact = {
        cacheKey,
        musicXml,
        warnings: [],
        stats: artifactStats,
      }
      const result: SheetWorkerResult = { type: 'result', requestId, artifact }
      self.postMessage(result)
      return
    } catch (webmscoreError) {
      console.warn('[SheetWorker] webmscore fallback to music21 due to error:', webmscoreError)
      useFallback = true
    }
  } else if (settings.advancedConverterMidiToMusicXml === 'music21-cloud') {
    try {
      const shards = plans.map(plan => serializeVoiceShard(source, plan))
      postProgress(requestId, 'converting', 'sheetMusic.progress.convertingVoiceShards', 'convertingVoiceShards', { count: shards.length })

      const shardXmls: { shard: any; musicXml: string }[] = []
      for (let index = 0; index < shards.length; index++) {
        const shard = shards[index]
        postProgress(requestId, 'converting', 'sheetMusic.progress.convertingVoiceShard', 'convertingVoiceShard', { current: index + 1, total: shards.length })
        
        const response = await fetch('https://pianogame.manh9011.qzz.io/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: shard.midiBytes as unknown as BodyInit,
        })
        
        if (!response.ok) {
          throw new Error(`Cloud converter HTTP ${response.status}: ${response.statusText}`)
        }
        
        const musicXml = await response.text()
        shardXmls.push({ shard, musicXml })
      }

      const musicXml = mergeShardMusicXml(shardXmls)
      const artifact: SheetMusicArtifact = {
        cacheKey,
        musicXml,
        warnings: [],
        stats: artifactStats,
      }
      const result: SheetWorkerResult = { type: 'result', requestId, artifact }
      self.postMessage(result)
      return
    } catch (cloudError) {
      console.warn('[SheetWorker] music21-cloud failed, falling back to local Pyodide music21:', cloudError)
      useFallback = true
    }
  } else {
    useFallback = true
  }
    
  if (useFallback) {
    // Fallback logic
    const shards = plans.map(plan => serializeVoiceShard(source, plan))
    const pyodide = await ensurePyodide(requestId)
    postProgress(requestId, 'converting', 'sheetMusic.progress.convertingVoiceShards', 'convertingVoiceShards', { count: shards.length })
    
    const shardXmls: { shard: any; musicXml: string }[] = []
    for (let index = 0; index < shards.length; index++) {
      const shard = shards[index]
      postProgress(requestId, 'converting', 'sheetMusic.progress.convertingVoiceShard', 'convertingVoiceShard', { current: index + 1, total: shards.length })
      const musicXml = await convertShard(pyodide, `/tmp/pianogame-shard-${requestId}-${index}.mid`, shard.midiBytes)
      shardXmls.push({ shard, musicXml })
    }

    const musicXml = mergeShardMusicXml(shardXmls)
    const artifact: SheetMusicArtifact = {
      cacheKey,
      musicXml,
      warnings: [],
      stats: artifactStats,
    }
    const result: SheetWorkerResult = { type: 'result', requestId, artifact }
    self.postMessage(result)
  }
}

self.onmessage = event => {
  const request = event.data as SheetWorkerRequest
  if (request.type !== 'generate') return

  handleGenerate(request).catch(error => {
    const sheetError = toSheetMusicError(error)
    const payload: SheetWorkerError = {
      type: 'error',
      requestId: request.requestId,
      message: sheetError.message,
      code: sheetError.code,
      values: sheetError.values,
    }
    self.postMessage(payload)
  })
}
