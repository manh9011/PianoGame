import * as Mp4Muxer from 'mp4-muxer'
import * as WebmMuxer from 'webm-muxer'

export interface MuxerBundle {
  muxer: any
  target: Mp4Muxer.ArrayBufferTarget | WebmMuxer.ArrayBufferTarget
}

export function createMuxerContainer(kind: 'mp4' | 'webm', width: number, height: number, fps: number, sampleRate: number): MuxerBundle {
  if (kind === 'mp4') {
    const target = new Mp4Muxer.ArrayBufferTarget()
    return {
      target,
      muxer: new Mp4Muxer.Muxer({
        target,
        video: {
          codec: 'avc',
          width,
          height,
          frameRate: fps,
        },
        audio: {
          codec: 'aac',
          sampleRate,
          numberOfChannels: 2,
        },
        fastStart: 'in-memory',
      }),
    }
  }

  const target = new WebmMuxer.ArrayBufferTarget()
  return {
    target,
    muxer: new WebmMuxer.Muxer({
      target,
      video: {
        codec: 'V_VP8',
        width,
        height,
        frameRate: fps,
      },
      audio: {
        codec: 'A_OPUS',
        sampleRate,
        numberOfChannels: 2,
      },
    }),
  }
}

export function finalizeMuxer(target: Mp4Muxer.ArrayBufferTarget | WebmMuxer.ArrayBufferTarget) {
  return target.buffer
}
