import { Midi } from '@tonejs/midi'
import type { SheetControlEvent, SheetKeySignatureEvent, SheetNoteEvent, SheetPitchBendEvent, SheetProgramEvent, SheetSourceModel, SheetSourceTrack, SheetTempoEvent, SheetTimeSignatureEvent } from './sheetTypes'

interface ToneControlEvent { ticks?: number; value?: number }
interface TonePitchBendEvent { ticks?: number; value?: number }
interface ToneTrackLike {
  name?: string
  channel?: number
  instrument?: { number?: number; name?: string; family?: string }
  controlChanges?: Record<string, ToneControlEvent[]>
  pitchBends?: TonePitchBendEvent[]
  notes: Array<{ midi: number; ticks: number; durationTicks: number; velocity: number }>
}

function channelOf(track: ToneTrackLike) {
  return Math.max(0, Math.min(15, track.channel ?? 0))
}

export function filterSheetSourceTracks(model: SheetSourceModel, includedTrackIds: number[] | undefined): SheetSourceModel {
  if (!includedTrackIds) return model

  const included = new Set(includedTrackIds)
  const tracks = model.tracks.filter(track => included.has(track.index))
  const durationTick = Math.max(0, ...tracks.flatMap(track => track.notes.map(note => note.endTick)))

  return {
    ...model,
    tracks,
    durationTick,
  }
}

export function createSheetSource(buffer: ArrayBuffer): SheetSourceModel {
  const midi = new Midi(buffer.slice(0))
  const ppq = midi.header.ppq || 480
  const tracks: SheetSourceTrack[] = (midi.tracks as ToneTrackLike[]).map((track, trackIndex) => {
    const channel = channelOf(track)
    const controls: SheetControlEvent[] = []
    for (const [controller, events] of Object.entries(track.controlChanges ?? {})) {
      for (const event of events ?? []) {
        controls.push({
          tick: Math.max(0, Math.round(event.ticks ?? 0)),
          controller: Number(controller),
          value: Math.round(Math.max(0, Math.min(1, Number(event.value ?? 0))) * 127),
          channel,
        })
      }
    }

    const program = Math.max(0, Math.min(127, track.instrument?.number ?? 0))
    const programs: SheetProgramEvent[] = [{ tick: 0, program, channel }]
    const pitchBends: SheetPitchBendEvent[] = (track.pitchBends ?? []).map(event => ({
      tick: Math.max(0, Math.round(event.ticks ?? 0)),
      value: Math.max(-1, Math.min(1, Number(event.value ?? 0))),
      channel,
    }))

    const notes: SheetNoteEvent[] = track.notes.map((note, noteIndex) => {
      const startTick = Math.max(0, Math.round(note.ticks))
      const endTick = Math.max(startTick + 1, Math.round(note.ticks + note.durationTicks))
      return {
        sourceTrackIndex: trackIndex,
        sourceNoteIndex: noteIndex,
        channel,
        pitch: note.midi,
        velocity: Math.max(1, Math.min(127, Math.round(note.velocity * 127))),
        startTick,
        endTick,
        notationStartTick: startTick,
        notationEndTick: endTick,
        staff: note.midi < 60 ? 2 : 1,
      }
    })

    return {
      index: trackIndex,
      name: track.name || `Track ${trackIndex + 1}`,
      channel,
      instrument: {
        program,
        name: track.instrument?.name || 'acoustic grand piano',
        family: track.instrument?.family || 'piano',
      },
      notes,
      controls: controls.sort((a, b) => a.tick - b.tick || a.controller - b.controller),
      programs,
      pitchBends: pitchBends.sort((a, b) => a.tick - b.tick),
    }
  })

  const tempos: SheetTempoEvent[] = midi.header.tempos.map(tempo => ({
    tick: Math.max(0, Math.round(tempo.ticks)),
    bpm: tempo.bpm,
    microsecondsPerQuarter: Math.round(60_000_000 / tempo.bpm),
  })).sort((a, b) => a.tick - b.tick)
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, bpm: 120, microsecondsPerQuarter: 500000 })

  const timeSignatures: SheetTimeSignatureEvent[] = midi.header.timeSignatures.map(signature => ({
    tick: Math.max(0, Math.round(signature.ticks)),
    numerator: signature.timeSignature[0] || 4,
    denominator: signature.timeSignature[1] || 4,
  })).sort((a, b) => a.tick - b.tick)
  if (!timeSignatures.length || timeSignatures[0].tick > 0) timeSignatures.unshift({ tick: 0, numerator: 4, denominator: 4 })

  const keySignatures: SheetKeySignatureEvent[] = midi.header.keySignatures.map(signature => ({
    tick: Math.max(0, Math.round(signature.ticks)),
    key: signature.key ?? 0,
    scale: signature.scale,
  })).sort((a, b) => a.tick - b.tick)

  const durationTick = Math.max(0, ...tracks.flatMap(track => track.notes.map(note => note.endTick)))

  return {
    ppq,
    name: midi.name || '',
    durationTick,
    tempos,
    timeSignatures,
    keySignatures,
    tracks,
  }
}
