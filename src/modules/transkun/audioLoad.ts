/**
 * Decode a user-supplied WAV/MP3 (or anything the browser's decoder supports) into mono
 * float32 PCM at the target sample rate (44100 Hz for Transkun). Uses the Web Audio API's
 * native decoder + resampler (decodeAudioData resamples to the context's own sample rate),
 * then downmixes multichannel audio to mono by averaging channels — matching the reference
 * pipeline's Framing.ReconstructMono.
 */
export async function loadAudioMono(file: File, targetSampleRate: number): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer()

  // Some browsers only resample correctly when decodeAudioData runs against a context
  // already at the target rate.
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  const ctx: AudioContext = new AudioCtx({ sampleRate: targetSampleRate })
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await ctx.close().catch(() => {})
  }

  // Belt-and-suspenders: if the browser still handed back a different sample rate,
  // resample explicitly via OfflineAudioContext before downmixing.
  if (audioBuffer.sampleRate !== targetSampleRate) {
    const offlineLength = Math.ceil(audioBuffer.duration * targetSampleRate)
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      offlineLength,
      targetSampleRate
    )
    const src = offlineCtx.createBufferSource()
    src.buffer = audioBuffer
    src.connect(offlineCtx.destination)
    src.start()
    audioBuffer = await offlineCtx.startRendering()
  }

  const { numberOfChannels, length } = audioBuffer
  const mono = new Float32Array(length)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++) mono[i] += data[i]
  }
  if (numberOfChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= numberOfChannels
  }
  return mono
}
