let activeContext: AudioContext | null = null

function getAudioContext() {
  activeContext ??= new AudioContext()
  return activeContext
}

function scheduleTone(context: AudioContext, frequency: number, startTime: number, duration: number, peakGain: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(frequency, startTime)
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.03)
}

export async function playRenderCompleteSound() {
  try {
    const context = getAudioContext()
    if (context.state === 'suspended') await context.resume()

    const startTime = context.currentTime + 0.02
    scheduleTone(context, 880, startTime, 0.16, 0.42)
    scheduleTone(context, 1174.66, startTime + 0.17, 0.18, 0.46)
    scheduleTone(context, 1567.98, startTime + 0.36, 0.26, 0.5)
  } catch {
    // Không để lỗi âm báo làm hỏng luồng export video.
  }
}
