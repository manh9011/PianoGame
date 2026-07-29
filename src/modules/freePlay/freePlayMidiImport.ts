import { DEFAULT_INSTRUMENT_PROGRAM } from '../audio/gmInstrumentCatalog'
import { TRACK_INVISIBLE_COLOR, TRACK_SETTINGS_PALETTE } from '../game/trackProperties'
import { parseMidi } from '../midi/midiParser'
import { pairMidiNotes } from '../midi/midiNotePairs'
import { DEFAULT_TEMPO, microsecondsPerQuarterToBpm } from '../midi/midiTempo'
import type { FreePlayRecordedNote, FreePlayTimeSignature, FreePlayTrack } from '../../stores/freePlayStore'

interface ImportedFreePlaySession {
  bpm: number
  timeSignature: FreePlayTimeSignature
  tracks: FreePlayTrack[]
  selectedTrackId: number
  nextTrackId: number
  nextNoteId: number
  truncatedTrackCount: number
}

const MAX_FREE_PLAY_TRACKS = 6
const FREE_PLAY_TIME_SIGNATURES: FreePlayTimeSignature[] = [
  'disabled',
  '2/4', '3/4', '4/4', '5/4', '6/4',
  '3/8', '4/8', '5/8', '6/8', '7/8', '8/8', '9/8', '10/8', '11/8', '12/8',
  '2/2', '3/2', '4/2',
]
const FREE_PLAY_TIME_SIGNATURE_SET = new Set<FreePlayTimeSignature>(FREE_PLAY_TIME_SIGNATURES)
const FREE_PLAY_DEFAULT_TRACK_COLOR = TRACK_SETTINGS_PALETTE[0] ?? '#729fcf'

function colorKey(color: string) {
  return color.trim().toLowerCase()
}

function resolveUniqueTrackColor(requestedColor: string | undefined, tracks: Pick<FreePlayTrack, 'id' | 'color'>[], trackId: number, fallbackIndex = 0) {
  const requested = requestedColor || TRACK_SETTINGS_PALETTE[fallbackIndex % TRACK_SETTINGS_PALETTE.length] || FREE_PLAY_DEFAULT_TRACK_COLOR
  if (requested === TRACK_INVISIBLE_COLOR) return requested

  const usedColors = new Set(
    tracks
      .filter(track => track.id !== trackId && track.color !== TRACK_INVISIBLE_COLOR)
      .map(track => colorKey(track.color)),
  )
  if (!usedColors.has(colorKey(requested))) return requested

  const requestedPaletteIndex = TRACK_SETTINGS_PALETTE.findIndex(color => colorKey(color) === colorKey(requested))
  const startIndex = requestedPaletteIndex >= 0 ? requestedPaletteIndex + 1 : fallbackIndex
  for (let offset = 0; offset < TRACK_SETTINGS_PALETTE.length; offset += 1) {
    const candidate = TRACK_SETTINGS_PALETTE[(startIndex + offset) % TRACK_SETTINGS_PALETTE.length]
    if (candidate && !usedColors.has(colorKey(candidate))) return candidate
  }
  return requested
}

function resolveFirstBpm(midi: ReturnType<typeof parseMidi>) {
  const tempo = midi.events
    .filter(candidate => candidate.type === 'tempo' && typeof candidate.tempo === 'number')
    .sort((left, right) => left.pulse - right.pulse)[0]?.tempo ?? DEFAULT_TEMPO
  return microsecondsPerQuarterToBpm(tempo)
}

function resolveFirstTimeSignature(midi: ReturnType<typeof parseMidi>): FreePlayTimeSignature {
  const event = midi.events
    .filter(candidate => candidate.type === 'timeSignature' && candidate.numerator && candidate.denominator)
    .sort((left, right) => left.pulse - right.pulse)[0]
  const signature = event ? `${event.numerator}/${event.denominator}` as FreePlayTimeSignature : 'disabled'
  return FREE_PLAY_TIME_SIGNATURE_SET.has(signature) ? signature : 'disabled'
}

export function buildFreePlaySessionFromMidi(buffer: ArrayBuffer): ImportedFreePlaySession {
  const midi = parseMidi(buffer)
  const pairedNotes = pairMidiNotes(midi)
  const notesByMidiTrackId = new Map<number, typeof pairedNotes>()

  for (const note of pairedNotes) {
    const notes = notesByMidiTrackId.get(note.trackId) ?? []
    notes.push(note)
    notesByMidiTrackId.set(note.trackId, notes)
  }

  const noteBearingTrackIds = midi.tracks
    .filter(track => (notesByMidiTrackId.get(track.trackId)?.length ?? 0) > 0)
    .map(track => track.trackId)
  const importedTrackIds = noteBearingTrackIds.slice(0, MAX_FREE_PLAY_TRACKS)
  const tracks: FreePlayTrack[] = []
  let nextNoteId = 1

  for (const [index, midiTrackId] of importedTrackIds.entries()) {
    const trackInfo = midi.tracks.find(track => track.trackId === midiTrackId)
    const trackId = index + 1
    const notes: FreePlayRecordedNote[] = (notesByMidiTrackId.get(midiTrackId) ?? []).map(note => ({
      id: `free:${nextNoteId++}`,
      trackId,
      noteId: note.noteId,
      startUs: Math.max(0, Math.round(note.startUs)),
      endUs: Math.max(Math.round(note.startUs) + 10_000, Math.round(note.endUs)),
      velocity: Math.max(0, Math.min(127, Math.round(note.velocity))),
      source: 'midi',
    }))

    tracks.push({
      id: trackId,
      name: (trackInfo?.name || trackInfo?.instrumentName || '').slice(0, 80),
      instrumentProgram: trackInfo?.instrumentProgram ?? DEFAULT_INSTRUMENT_PROGRAM,
      color: resolveUniqueTrackColor(undefined, tracks, trackId, index),
      loop: false,
      notes,
    })
  }

  if (!tracks.length) {
    tracks.push({
      id: 1,
      name: '',
      instrumentProgram: DEFAULT_INSTRUMENT_PROGRAM,
      color: resolveUniqueTrackColor(undefined, [], 1, 0),
      loop: false,
      notes: [],
    })
  }

  return {
    bpm: resolveFirstBpm(midi),
    timeSignature: resolveFirstTimeSignature(midi),
    tracks,
    selectedTrackId: tracks[0]?.id ?? 1,
    nextTrackId: Math.max(...tracks.map(track => track.id)) + 1,
    nextNoteId,
    truncatedTrackCount: Math.max(0, noteBearingTrackIds.length - importedTrackIds.length),
  }
}
