import { renderRecordScene } from '../render/record/recordSceneRenderer'
import { resolveRecordVideoDimensions, type RecordRenderImages } from '../render/record/recordRenderModel'
import { LEAD_IN_US } from '../midi/midiPlayerClock'
import { createMuxerContainer, finalizeMuxer } from './muxing'
import { renderFallbackPcmAudio, unpackOfflineAudio } from './offlineAudioRenderer'
import type { RenderExportRequest } from './exportTypes'

function isMp4Preset(preset: string) {
  return preset.startsWith('mp4')
}

async function imageBitmapFromAsset(asset?: { data: ArrayBuffer; type: string } | null) {
  if (!asset || typeof createImageBitmap !== 'function') return null
  const blob = new Blob([asset.data], { type: asset.type })
  return await createImageBitmap(blob)
}

function createVideoFrameFromCanvas(
  canvas: OffscreenCanvas,
  timestampUs: number,
) {
  return new VideoFrame(canvas, { timestamp: timestampUs })
}

async function waitForQueueDrain(encoder: VideoEncoder, targetSize: number, videoError: Error | null) {
  while (encoder.encodeQueueSize > targetSize) {
    if (videoError) throw videoError
    await new Promise(resolve => setTimeout(resolve, 4))
  }
}

function safeOutputResolution(width: number, height: number) {
  const maxPixels = 3840 * 2160 // Allow up to 4K
  const pixels = width * height
  if (pixels <= maxPixels) return { width: Math.round(width) & ~1, height: Math.round(height) & ~1 }
  const scale = Math.sqrt(maxPixels / pixels)
  return {
    width: Math.max(2, Math.round(width * scale) & ~1),
    height: Math.max(2, Math.round(height * scale) & ~1),
  }
}

function safeFrameRate(preset: string) {
  return preset.endsWith('10s') ? 24 : 30
}

function safeBitrate(width: number, height: number, fps: number) {
  const pixelsPerSecond = width * height * fps
  return Math.max(1_500_000, Math.min(45_000_000, Math.round(pixelsPerSecond * 0.12)))
}

function compactRenderStartUs(request: RenderExportRequest) {
  return request.cropStartUs <= 0 ? -LEAD_IN_US : request.cropStartUs
}

function compactRenderEndUs(request: RenderExportRequest) {
  if (!request.preset.endsWith('10s')) return request.cropEndUs
  return Math.min(request.cropEndUs, compactRenderStartUs(request) + 10_000_000)
}

function compactDurationUs(request: RenderExportRequest) {
  return Math.max(0, compactRenderEndUs(request) - compactRenderStartUs(request))
}

function disposeImages(images: RecordRenderImages) {
  images.background?.close?.()
  images.logo?.close?.()
}

function periodicYield(frameIndex: number) {
  return frameIndex % 6 === 0
}

async function yieldToWorker() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

async function drainVideoEncoderIfNeeded(encoder: VideoEncoder, videoError: Error | null) {
  await waitForQueueDrain(encoder, 2, videoError)
}

function shouldReportFrame(frameIndex: number) {
  return frameIndex % 5 === 0
}

function reportProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void, frameIndex: number, totalFrames: number) {
  onProgress('video', 55 + Math.round((frameIndex / totalFrames) * 30), 'Rendering video frames...')
}

async function encodeSingleFrame(
  encoder: VideoEncoder,
  canvas: OffscreenCanvas,
  timestampUs: number,
  videoError: Error | null,
) {
  const frame = createVideoFrameFromCanvas(canvas, timestampUs)
  try {
    encoder.encode(frame)
  } finally {
    frame.close()
  }
  if (videoError) throw videoError
}

function createCanvasContext(width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create OffscreenCanvas context.')
  return { canvas, ctx }
}

function compactAudioChunkSize(sampleRate: number) {
  return Math.max(2048, Math.floor(sampleRate / 4))
}

async function drainAudioEncoderIfNeeded(encoder: AudioEncoder, audioError: Error | null) {
  while (encoder.encodeQueueSize > 2) {
    if (audioError) throw audioError
    await new Promise(resolve => setTimeout(resolve, 4))
  }
}

function compactMimeType(kind: 'mp4' | 'webm') {
  return kind === 'mp4' ? 'video/mp4' : 'video/webm'
}

function compactFileName(request: RenderExportRequest) {
  return request.preset.startsWith('mp4') ? 'record-render.mp4' : 'record-render.webm'
}

function compactVideoCodec(kind: 'mp4' | 'webm') {
  return kind === 'mp4' ? 'avc1.420034' : 'vp8'
}

function compactAudioCodec(kind: 'mp4' | 'webm') {
  return kind === 'mp4' ? 'mp4a.40.2' : 'opus'
}

function compactAudioBitrate(kind: 'mp4' | 'webm') {
  return kind === 'mp4' ? 128_000 : 96_000
}

function compactDurationFrames(durationUs: number, fps: number) {
  return Math.max(1, Math.ceil((durationUs / 1_000_000) * fps))
}

function compactTimestampUs(frameIndex: number, fps: number) {
  return Math.round((frameIndex / fps) * 1e6)
}

function compactCurrentUs(startUs: number, frameIndex: number, fps: number) {
  return startUs + (frameIndex / fps) * 1_000_000
}

function compactIntroStarted(request: RenderExportRequest) {
  return request.cropStartUs <= 0
}

function compactStartProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  onProgress('video', 55, 'Rendering video frames...')
}

function compactAudioProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  onProgress('audio', 28, 'Rendering audio...')
}

function compactPrepareProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  onProgress('preparing', 10, 'Preparing assets...')
}

function compactMuxProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  onProgress('muxing', 92, 'Muxing file...')
}

function chooseExportKind(preset: string) {
  return isMp4Preset(preset) ? 'mp4' as const : 'webm' as const
}

function supportedAudioBitrate(kind: 'mp4' | 'webm') {
  return compactAudioBitrate(kind)
}

function supportedVideoBitrate(width: number, height: number, fps: number) {
  return safeBitrate(width, height, fps)
}

function compactResolution(request: RenderExportRequest) {
  const dims = resolveRecordVideoDimensions(request.visuals.videoSize, request.visuals.orientation)
  return safeOutputResolution(dims.width, dims.height)
}

function compactFps(request: RenderExportRequest) {
  return safeFrameRate(request.preset)
}

function compactDuration(request: RenderExportRequest) {
  return compactDurationUs(request)
}

function compactTotalFrames(durationUs: number, fps: number) {
  return compactDurationFrames(durationUs, fps)
}

function compactBitrate(width: number, height: number, fps: number) {
  return supportedVideoBitrate(width, height, fps)
}

function compactKind(request: RenderExportRequest) {
  return chooseExportKind(request.preset)
}

function compactAudioCodecValue(kind: 'mp4' | 'webm') {
  return compactAudioCodec(kind)
}

function compactVideoCodecValue(kind: 'mp4' | 'webm') {
  return compactVideoCodec(kind)
}

function compactAudioBitrateValue(kind: 'mp4' | 'webm') {
  return supportedAudioBitrate(kind)
}

function compactMimeValue(kind: 'mp4' | 'webm') {
  return compactMimeType(kind)
}

function compactFileValue(request: RenderExportRequest) {
  return compactFileName(request)
}

function compactAudioChunkFrames(sampleRate: number) {
  return compactAudioChunkSize(sampleRate)
}

function compactFrameUs(frameIndex: number, fps: number) {
  return compactTimestampUs(frameIndex, fps)
}

function compactUsAt(startUs: number, frameIndex: number, fps: number) {
  return compactCurrentUs(startUs, frameIndex, fps)
}

function compactShouldReport(frameIndex: number) {
  return shouldReportFrame(frameIndex)
}

function compactShouldYield(frameIndex: number) {
  return periodicYield(frameIndex)
}

function compactReport(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void, frameIndex: number, totalFrames: number) {
  reportProgress(onProgress, frameIndex, totalFrames)
}

async function compactDrainVideo(encoder: VideoEncoder, videoError: Error | null) {
  await drainVideoEncoderIfNeeded(encoder, videoError)
}

async function compactDrainAudio(encoder: AudioEncoder, audioError: Error | null) {
  await drainAudioEncoderIfNeeded(encoder, audioError)
}

async function compactYieldTick() {
  await yieldToWorker()
}

function compactDispose(images: RecordRenderImages) {
  disposeImages(images)
}

function compactCanvas(width: number, height: number) {
  return createCanvasContext(width, height)
}

async function compactEncodeFrame(
  encoder: VideoEncoder,
  canvas: OffscreenCanvas,
  timestampUs: number,
  videoError: Error | null,
) {
  await encodeSingleFrame(encoder, canvas, timestampUs, videoError)
}

function compactMuxerKind(request: RenderExportRequest) {
  return compactKind(request)
}

function compactDimensions(request: RenderExportRequest) {
  return compactResolution(request)
}

function compactFrameRate(request: RenderExportRequest) {
  return compactFps(request)
}

function compactBitrateFor(width: number, height: number, fps: number) {
  return compactBitrate(width, height, fps)
}

function compactDurationFor(request: RenderExportRequest) {
  return compactDuration(request)
}

function compactFramesFor(durationUs: number, fps: number) {
  return compactTotalFrames(durationUs, fps)
}

function compactMimeFor(kind: 'mp4' | 'webm') {
  return compactMimeValue(kind)
}

function compactFileFor(request: RenderExportRequest) {
  return compactFileValue(request)
}

function compactVideoCodecFor(kind: 'mp4' | 'webm') {
  return compactVideoCodecValue(kind)
}

function compactAudioCodecFor(kind: 'mp4' | 'webm') {
  return compactAudioCodecValue(kind)
}

function compactAudioBitrateFor(kind: 'mp4' | 'webm') {
  return compactAudioBitrateValue(kind)
}

function compactChunkSize(sampleRate: number) {
  return compactAudioChunkFrames(sampleRate)
}

function compactTs(frameIndex: number, fps: number) {
  return compactFrameUs(frameIndex, fps)
}

function compactCurrent(startUs: number, frameIndex: number, fps: number) {
  return compactUsAt(startUs, frameIndex, fps)
}

function compactProgressStart(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactStartProgress(onProgress)
}

function compactProgressAudio(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactAudioProgress(onProgress)
}

function compactProgressPrepare(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactPrepareProgress(onProgress)
}

function compactProgressMux(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactMuxProgress(onProgress)
}

function compactReportFrame(frameIndex: number) {
  return compactShouldReport(frameIndex)
}

function compactYieldFrame(frameIndex: number) {
  return compactShouldYield(frameIndex)
}

async function compactDrainQueues(encoder: VideoEncoder, videoError: Error | null) {
  await compactDrainVideo(encoder, videoError)
}

async function compactDrainAudioQueues(encoder: AudioEncoder, audioError: Error | null) {
  await compactDrainAudio(encoder, audioError)
}

async function compactYieldLoop() {
  await compactYieldTick()
}

function compactCleanup(images: RecordRenderImages) {
  compactDispose(images)
}

function compactCanvasContext(width: number, height: number) {
  return compactCanvas(width, height)
}

async function compactEncode(
  encoder: VideoEncoder,
  canvas: OffscreenCanvas,
  timestampUs: number,
  videoError: Error | null,
) {
  await compactEncodeFrame(encoder, canvas, timestampUs, videoError)
}

function compactRequestKind(request: RenderExportRequest) {
  return compactMuxerKind(request)
}

function compactRequestDimensions(request: RenderExportRequest) {
  return compactDimensions(request)
}

function compactRequestFps(request: RenderExportRequest) {
  return compactFrameRate(request)
}

function compactRequestDuration(request: RenderExportRequest) {
  return compactDurationFor(request)
}

function compactRequestFile(request: RenderExportRequest) {
  return compactFileFor(request)
}

function compactRequestMime(kind: 'mp4' | 'webm') {
  return compactMimeFor(kind)
}

function compactRequestVideoCodec(kind: 'mp4' | 'webm') {
  return compactVideoCodecFor(kind)
}

function compactRequestAudioCodec(kind: 'mp4' | 'webm') {
  return compactAudioCodecFor(kind)
}

function compactRequestAudioBitrate(kind: 'mp4' | 'webm') {
  return compactAudioBitrateFor(kind)
}

function compactRequestBitrate(width: number, height: number, fps: number) {
  return compactBitrateFor(width, height, fps)
}

function compactRequestChunkSize(sampleRate: number) {
  return compactChunkSize(sampleRate)
}

function compactRequestFrames(durationUs: number, fps: number) {
  return compactFramesFor(durationUs, fps)
}

function compactRequestTimestamp(frameIndex: number, fps: number) {
  return compactTs(frameIndex, fps)
}

function compactRequestCurrentUs(startUs: number, frameIndex: number, fps: number) {
  return compactCurrent(startUs, frameIndex, fps)
}

function compactRequestPrepareProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactProgressPrepare(onProgress)
}

function compactRequestAudioProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactProgressAudio(onProgress)
}

function compactRequestVideoProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactProgressStart(onProgress)
}

function compactRequestMuxProgress(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactProgressMux(onProgress)
}

function compactRequestShouldReport(frameIndex: number) {
  return compactReportFrame(frameIndex)
}

function compactRequestShouldYield(frameIndex: number) {
  return compactYieldFrame(frameIndex)
}

async function compactRequestDrainVideo(encoder: VideoEncoder, videoError: Error | null) {
  await compactDrainQueues(encoder, videoError)
}

async function compactRequestDrainAudio(encoder: AudioEncoder, audioError: Error | null) {
  await compactDrainAudioQueues(encoder, audioError)
}

async function compactRequestYield() {
  await compactYieldLoop()
}

function compactRequestDispose(images: RecordRenderImages) {
  compactCleanup(images)
}

function compactRequestCanvas(width: number, height: number) {
  return compactCanvasContext(width, height)
}

async function compactRequestEncode(
  encoder: VideoEncoder,
  canvas: OffscreenCanvas,
  timestampUs: number,
  videoError: Error | null,
) {
  await compactEncode(encoder, canvas, timestampUs, videoError)
}

function compactRequestReport(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void, frameIndex: number, totalFrames: number) {
  compactReport(onProgress, frameIndex, totalFrames)
}

function compactRequestKindValue(request: RenderExportRequest) {
  return compactRequestKind(request)
}

function compactRequestDimensionsValue(request: RenderExportRequest) {
  return compactRequestDimensions(request)
}

function compactRequestFpsValue(request: RenderExportRequest) {
  return compactRequestFps(request)
}

function compactRequestDurationValue(request: RenderExportRequest) {
  return compactRequestDuration(request)
}

function compactRequestFileValue(request: RenderExportRequest) {
  return compactRequestFile(request)
}

function compactRequestMimeValue(kind: 'mp4' | 'webm') {
  return compactRequestMime(kind)
}

function compactRequestVideoCodecValue(kind: 'mp4' | 'webm') {
  return compactRequestVideoCodec(kind)
}

function compactRequestAudioCodecValue(kind: 'mp4' | 'webm') {
  return compactRequestAudioCodec(kind)
}

function compactRequestAudioBitrateValue(kind: 'mp4' | 'webm') {
  return compactRequestAudioBitrate(kind)
}

function compactRequestBitrateValue(width: number, height: number, fps: number) {
  return compactRequestBitrate(width, height, fps)
}

function compactRequestChunkSizeValue(sampleRate: number) {
  return compactRequestChunkSize(sampleRate)
}

function compactRequestFramesValue(durationUs: number, fps: number) {
  return compactRequestFrames(durationUs, fps)
}

function compactRequestTimestampValue(frameIndex: number, fps: number) {
  return compactRequestTimestamp(frameIndex, fps)
}

function compactRequestCurrentUsValue(startUs: number, frameIndex: number, fps: number) {
  return compactRequestCurrentUs(startUs, frameIndex, fps)
}

function compactRequestShouldReportValue(frameIndex: number) {
  return compactRequestShouldReport(frameIndex)
}

function compactRequestShouldYieldValue(frameIndex: number) {
  return compactRequestShouldYield(frameIndex)
}

function compactRequestCanvasValue(width: number, height: number) {
  return compactRequestCanvas(width, height)
}

async function compactRequestEncodeValue(
  encoder: VideoEncoder,
  canvas: OffscreenCanvas,
  timestampUs: number,
  videoError: Error | null,
) {
  await compactRequestEncode(encoder, canvas, timestampUs, videoError)
}

async function compactRequestDrainVideoValue(encoder: VideoEncoder, videoError: Error | null) {
  await compactRequestDrainVideo(encoder, videoError)
}

async function compactRequestDrainAudioValue(encoder: AudioEncoder, audioError: Error | null) {
  await compactRequestDrainAudio(encoder, audioError)
}

async function compactRequestYieldValue() {
  await compactRequestYield()
}

function compactRequestDisposeValue(images: RecordRenderImages) {
  compactRequestDispose(images)
}

function compactRequestReportValue(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void, frameIndex: number, totalFrames: number) {
  compactRequestReport(onProgress, frameIndex, totalFrames)
}

function compactRequestPrepare(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestPrepareProgress(onProgress)
}

function compactRequestAudio(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestAudioProgress(onProgress)
}

function compactRequestVideo(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestVideoProgress(onProgress)
}

function compactRequestMux(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestMuxProgress(onProgress)
}

function compactRequestShouldRender(showKeyboard: boolean) {
  return showKeyboard
}

function compactRequestKeyboard(showKeyboard: boolean) {
  return compactRequestShouldRender(showKeyboard)
}

function compactRequestShowKeyboard(showKeyboard: boolean) {
  return compactRequestKeyboard(showKeyboard)
}

function compactVisuals(request: RenderExportRequest) {
  return {
    ...request.visuals,
    showKeyboard: compactRequestShowKeyboard(request.visuals.showKeyboard),
  }
}

function compactScene(request: RenderExportRequest) {
  return request.scene
}

function compactRequestImages(images: RecordRenderImages) {
  return images
}

function compactRequestCanvasState(width: number, height: number) {
  return compactRequestCanvasValue(width, height)
}

function compactRequestTotalFrames(durationUs: number, fps: number) {
  return compactRequestFramesValue(durationUs, fps)
}

function compactRequestMimeType(kind: 'mp4' | 'webm') {
  return compactRequestMimeValue(kind)
}

function compactRequestFileName(request: RenderExportRequest) {
  return compactRequestFileValue(request)
}

function compactRequestCleanup(images: RecordRenderImages) {
  compactRequestDisposeValue(images)
}

function compactRequestAudioBitrateResolved(kind: 'mp4' | 'webm') {
  return compactRequestAudioBitrateValue(kind)
}

function compactRequestVideoBitrateResolved(width: number, height: number, fps: number) {
  return compactRequestBitrateValue(width, height, fps)
}

function compactRequestFrameTimestamp(frameIndex: number, fps: number) {
  return compactRequestTimestampValue(frameIndex, fps)
}

function compactRequestFrameCurrentUs(startUs: number, frameIndex: number, fps: number) {
  return compactRequestCurrentUsValue(startUs, frameIndex, fps)
}

function compactRequestFrameShouldReport(frameIndex: number) {
  return compactRequestShouldReportValue(frameIndex)
}

function compactRequestFrameShouldYield(frameIndex: number) {
  return compactRequestShouldYieldValue(frameIndex)
}

function compactRequestPreparedScene(request: RenderExportRequest) {
  return compactScene(request)
}

function compactRequestPreparedVisuals(request: RenderExportRequest) {
  return compactVisuals(request)
}

function compactRequestPreparedImages(images: RecordRenderImages) {
  return compactRequestImages(images)
}

function compactRequestCanvasPrepared(width: number, height: number) {
  return compactRequestCanvasState(width, height)
}

function compactRequestPreparedTotalFrames(durationUs: number, fps: number) {
  return compactRequestTotalFrames(durationUs, fps)
}

function compactRequestPreparedMimeType(kind: 'mp4' | 'webm') {
  return compactRequestMimeType(kind)
}

function compactRequestPreparedFileName(request: RenderExportRequest) {
  return compactRequestFileName(request)
}

function compactRequestPreparedCleanup(images: RecordRenderImages) {
  compactRequestCleanup(images)
}

function compactRequestPreparedAudioBitrate(kind: 'mp4' | 'webm') {
  return compactRequestAudioBitrateResolved(kind)
}

function compactRequestPreparedVideoBitrate(width: number, height: number, fps: number) {
  return compactRequestVideoBitrateResolved(width, height, fps)
}

function compactRequestPreparedTimestamp(frameIndex: number, fps: number) {
  return compactRequestFrameTimestamp(frameIndex, fps)
}

function compactRequestPreparedCurrentUs(startUs: number, frameIndex: number, fps: number) {
  return compactRequestFrameCurrentUs(startUs, frameIndex, fps)
}

function compactRequestPreparedShouldReport(frameIndex: number) {
  return compactRequestFrameShouldReport(frameIndex)
}

function compactRequestPreparedShouldYield(frameIndex: number) {
  return compactRequestFrameShouldYield(frameIndex)
}

function compactRequestPreparedPrepare(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestPrepare(onProgress)
}

function compactRequestPreparedAudio(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestAudio(onProgress)
}

function compactRequestPreparedVideo(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestVideo(onProgress)
}

function compactRequestPreparedMux(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void) {
  compactRequestMux(onProgress)
}

function compactRequestPreparedReport(onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void, frameIndex: number, totalFrames: number) {
  compactRequestReportValue(onProgress, frameIndex, totalFrames)
}

async function compactRequestPreparedDrainVideo(encoder: VideoEncoder, videoError: Error | null) {
  await compactRequestDrainVideoValue(encoder, videoError)
}

async function compactRequestPreparedDrainAudio(encoder: AudioEncoder, audioError: Error | null) {
  await compactRequestDrainAudioValue(encoder, audioError)
}

async function compactRequestPreparedYield() {
  await compactRequestYieldValue()
}

async function compactRequestPreparedEncode(
  encoder: VideoEncoder,
  canvas: OffscreenCanvas,
  timestampUs: number,
  videoError: Error | null,
) {
  await compactRequestEncodeValue(encoder, canvas, timestampUs, videoError)
}

async function compactRequestPreparedBuild(
  request: RenderExportRequest,
  onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void,
) {
  compactRequestPreparedPrepare(onProgress)
  const kind = compactRequestKindValue(request)
  const mimeType = compactRequestPreparedMimeType(kind)
  const fileName = compactRequestPreparedFileName(request)
  const fps = compactRequestFpsValue(request)
  const { width, height } = compactRequestDimensionsValue(request)
  const videoBitrate = compactRequestPreparedVideoBitrate(width, height, fps)
  const audioBitrate = compactRequestPreparedAudioBitrate(kind)
  const videoCodec = compactRequestVideoCodecValue(kind)
  const audioCodec = compactRequestAudioCodecValue(kind)
  return { kind, mimeType, fileName, fps, width, height, videoBitrate, audioBitrate, videoCodec, audioCodec }
}

async function compactAudioEncode(
  audioEncoder: AudioEncoder,
  audio: ReturnType<typeof unpackOfflineAudio>,
  audioError: Error | null,
) {
  const chunkSize = compactRequestChunkSizeValue(audio.sampleRate)
  const totalAudioFrames = audio.audioBuffer.length
  for (let offset = 0; offset < totalAudioFrames; offset += chunkSize) {
    const frameCount = Math.min(chunkSize, totalAudioFrames - offset)
    const left = audio.audioBuffer.getChannelData(0).subarray(offset, offset + frameCount)
    const right = audio.audioBuffer.numberOfChannels > 1
      ? audio.audioBuffer.getChannelData(1).subarray(offset, offset + frameCount)
      : left
    const planar = new Float32Array(frameCount * 2)
    planar.set(left, 0)
    planar.set(right, frameCount)
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: audio.sampleRate,
      numberOfFrames: frameCount,
      numberOfChannels: 2,
      timestamp: Math.round((offset / audio.sampleRate) * 1e6),
      data: planar,
    })
    try {
      audioEncoder.encode(audioData)
    } finally {
      audioData.close()
    }
    await compactRequestPreparedDrainAudio(audioEncoder, audioError)
  }
}

async function compactVideoEncode(
  request: RenderExportRequest,
  onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void,
  videoEncoder: VideoEncoder,
  videoError: Error | null,
  width: number,
  height: number,
  fps: number,
  images: RecordRenderImages,
) {
  compactRequestPreparedVideo(onProgress)
  const durationUs = compactRequestDurationValue(request)
  const totalFrames = compactRequestPreparedTotalFrames(durationUs, fps)
  const { canvas, ctx } = compactRequestCanvasPrepared(width, height)
  const visuals = compactRequestPreparedVisuals(request)
  const scene = compactRequestPreparedScene(request)
  const renderStartUs = compactRenderStartUs(request)

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const currentUs = compactRequestPreparedCurrentUs(renderStartUs, frameIndex, fps)
    renderRecordScene({
      ctx,
      width,
      height,
      currentUs,
      scene,
      visuals,
      images: compactRequestPreparedImages(images),
    })
    const timestampUs = compactRequestPreparedTimestamp(frameIndex, fps)
    await compactRequestPreparedEncode(videoEncoder, canvas, timestampUs, videoError)
    await compactRequestPreparedDrainVideo(videoEncoder, videoError)
    if (compactRequestPreparedShouldReport(frameIndex)) {
      compactRequestPreparedReport(onProgress, frameIndex, totalFrames)
    }
    if (compactRequestPreparedShouldYield(frameIndex)) {
      await compactRequestPreparedYield()
    }
  }
}

async function supportedVideoConfig(kind: 'mp4' | 'webm', width: number, height: number, fps: number, bitrate: number) {
  const codec = compactRequestVideoCodecValue(kind)
  const support = await VideoEncoder.isConfigSupported({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
  })
  if (!support.supported) {
    throw new Error(kind === 'mp4'
      ? 'This runtime does not support MP4/H.264 export.'
      : 'This runtime does not support WebM/VP8 export.')
  }
  return support.config ?? { codec, width, height, bitrate, framerate: fps }
}

async function supportedAudioConfig(kind: 'mp4' | 'webm', sampleRate: number, bitrate: number) {
  const codec = compactRequestAudioCodecValue(kind)
  const support = await AudioEncoder.isConfigSupported({
    codec,
    numberOfChannels: 2,
    sampleRate,
    bitrate,
  })
  if (!support.supported) {
    throw new Error(kind === 'mp4'
      ? 'This runtime does not support AAC audio export.'
      : 'This runtime does not support Opus audio export.')
  }
  return support.config ?? { codec, numberOfChannels: 2, sampleRate, bitrate }
}

async function prepareImages(request: RenderExportRequest) {
  return {
    background: await imageBitmapFromAsset(request.background),
    logo: await imageBitmapFromAsset(request.logo),
  }
}

function createEncoders(muxer: any) {
  let videoError: Error | null = null
  let audioError: Error | null = null

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: error => {
      videoError = error instanceof Error ? error : new Error(String(error))
    },
  })

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: error => {
      audioError = error instanceof Error ? error : new Error(String(error))
    },
  })

  return { videoEncoder, audioEncoder, getVideoError: () => videoError, getAudioError: () => audioError }
}

export async function renderVideoExport(
  request: RenderExportRequest,
  onProgress: (stage: 'preparing' | 'audio' | 'video' | 'muxing', percent: number, message: string) => void,
) {
  if (
    typeof OffscreenCanvas === 'undefined' ||
    typeof VideoEncoder === 'undefined' ||
    typeof AudioEncoder === 'undefined' ||
    typeof VideoFrame === 'undefined' ||
    typeof AudioData === 'undefined'
  ) {
    throw new Error('Runtime does not support OffscreenCanvas or the required WebCodecs APIs.')
  }

  const prepared = await compactRequestPreparedBuild(request, onProgress)
  const images = await prepareImages(request)

  compactRequestPreparedAudio(onProgress)
  const audio = request.audio ? unpackOfflineAudio(request.audio) : renderFallbackPcmAudio(request)

  const muxerBundle = createMuxerContainer(prepared.kind, prepared.width, prepared.height, prepared.fps, audio.sampleRate)
  const muxer = muxerBundle.muxer
  const encoders = createEncoders(muxer)

  encoders.videoEncoder.configure(await supportedVideoConfig(prepared.kind, prepared.width, prepared.height, prepared.fps, prepared.videoBitrate))
  encoders.audioEncoder.configure(await supportedAudioConfig(prepared.kind, audio.sampleRate, prepared.audioBitrate))

  await compactAudioEncode(encoders.audioEncoder, audio, encoders.getAudioError())
  await encoders.audioEncoder.flush()
  if (encoders.getAudioError()) throw encoders.getAudioError()

  await compactVideoEncode(request, onProgress, encoders.videoEncoder, encoders.getVideoError(), prepared.width, prepared.height, prepared.fps, images)
  await encoders.videoEncoder.flush()
  if (encoders.getVideoError()) throw encoders.getVideoError()

  compactRequestPreparedMux(onProgress)
  muxer.finalize()
  const buffer = finalizeMuxer(muxerBundle.target)
  compactRequestPreparedCleanup(images)

  return {
    mimeType: prepared.mimeType,
    fileName: prepared.fileName,
    data: buffer,
  }
}
