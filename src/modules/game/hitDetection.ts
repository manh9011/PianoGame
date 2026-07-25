import type { TrackProperties } from './trackProperties'
import type { HandSelection, PlaySession, SessionNote } from './playSession'
import { addActivePlaybackCounter, isPlaybackProfilerEnabled, setActivePlaybackGauge } from '../perf/playbackProfiler'
export const HIT_WINDOW_US = 330000
export const CHORD_START_TOLERANCE_US = 2000

const trackLookupCache = new WeakMap<TrackProperties[], Map<number, TrackProperties>>()
const noteOrderCache = new WeakMap<SessionNote[], boolean>()
const earliestWaitingCursorCache = new WeakMap<PlaySession, { notes: SessionNote[]; cursor: number; key: string }>()
const dueWaitingCursorCache = new WeakMap<PlaySession, { notes: SessionNote[]; cursor: number; lastUs: number; key: string }>()
const missCursorCache = new WeakMap<PlaySession, { notes: SessionNote[]; cursor: number; lastUs: number; key: string }>()

function trackById(tracks: TrackProperties[]) {
  const cached = trackLookupCache.get(tracks)
  if (cached) return cached
  const lookup = new Map(tracks.map(track => [track.trackId, track]))
  trackLookupCache.set(tracks, lookup)
  return lookup
}

function notesSortedByStart(notes: SessionNote[]) {
  const cached = noteOrderCache.get(notes)
  if (cached !== undefined) return cached
  for (let index = 1; index < notes.length; index += 1) {
    if (notes[index].start < notes[index - 1].start) {
      noteOrderCache.set(notes, false)
      return false
    }
  }
  noteOrderCache.set(notes, true)
  return true
}

function lowerBoundStart(notes: SessionNote[], startUs: number) {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (notes[mid].start < startUs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function playableKey(tracks: TrackProperties[], handSelection: HandSelection, session?: PlaySession) {
  const range = session?.keyboardRange
  return [
    handSelection,
    range ? `${range.lowNote}:${range.highNote}` : '',
    tracks.map(track => `${track.trackId}:${track.mode}`).join('|'),
  ].join('|')
}

export function handMatches(selection: HandSelection, note: SessionNote) {
  return selection === 'both' || note.hand === selection
}

export function isNoteInKeyboardRange(note: SessionNote, session: PlaySession): boolean {
  if (!session.keyboardRange) return true
  return note.noteId >= session.keyboardRange.lowNote && note.noteId <= session.keyboardRange.highNote
}

export function isPlayableNote(note: SessionNote, tracks: TrackProperties[], handSelection: HandSelection, session?: PlaySession) {
  const track = trackById(tracks).get(note.trackId)
  if (!track || track.mode !== 'youPlay' || !handMatches(handSelection, note)) return false
  if (session && !isNoteInKeyboardRange(note, session)) return false
  return true
}

export function playableWaitingNotes(notes: SessionNote[], tracks: TrackProperties[], handSelection: HandSelection, session?: PlaySession) {
  return notes.filter(note => isPlayableNote(note, tracks, handSelection, session) && note.state === 'waiting')
}

export function findEarliestPlayableWaitingStart(notes: SessionNote[], tracks: TrackProperties[], handSelection: HandSelection, session?: PlaySession) {
  if (!notesSortedByStart(notes)) {
    let earliest = Infinity
    for (const note of notes) {
      if (!isPlayableNote(note, tracks, handSelection, session) || note.state !== 'waiting') continue
      if (note.start < earliest) earliest = note.start
    }
    return Number.isFinite(earliest) ? earliest : null
  }

  if (!session) {
    for (const note of notes) {
      if (note.state === 'waiting' && isPlayableNote(note, tracks, handSelection, session)) return note.start
    }
    return null
  }

  const key = playableKey(tracks, handSelection, session)
  const cached = earliestWaitingCursorCache.get(session)
  const shouldReset = !cached || cached.notes !== notes || cached.key !== key
  const state = shouldReset ? { notes, cursor: 0, key } : cached
  if (shouldReset) earliestWaitingCursorCache.set(session, state)

  while (state.cursor < notes.length) {
    const note = notes[state.cursor]
    if (note.state === 'waiting' && isPlayableNote(note, tracks, handSelection, session)) return note.start
    state.cursor += 1
  }
  return null
}

export function findPlayableWaitingNoteDueBy(notes: SessionNote[], tracks: TrackProperties[], handSelection: HandSelection, currentUs: number, session?: PlaySession) {
  let scanned = 0
  if (!session || !notesSortedByStart(notes)) {
    for (const note of notes) {
      scanned += 1
      if (isPlayableNote(note, tracks, handSelection, session) && note.state === 'waiting' && note.start <= currentUs) {
        return { note, scanned }
      }
    }
    return { note: undefined, scanned }
  }

  const key = playableKey(tracks, handSelection, session)
  const cached = dueWaitingCursorCache.get(session)
  const shouldReset = !cached || cached.notes !== notes || cached.lastUs > currentUs || cached.key !== key
  const state = shouldReset ? { notes, cursor: 0, lastUs: currentUs, key } : cached
  if (shouldReset) dueWaitingCursorCache.set(session, state)

  while (state.cursor < notes.length) {
    const note = notes[state.cursor]
    scanned += 1
    if (note.start > currentUs) break
    if (note.state === 'waiting' && isPlayableNote(note, tracks, handSelection, session)) {
      state.lastUs = currentUs
      return { note, scanned }
    }
    state.cursor += 1
  }

  state.lastUs = currentUs
  return { note: undefined, scanned }
}

export function collectChordAtStart(notes: SessionNote[], tracks: TrackProperties[], handSelection: HandSelection, startUs: number, session?: PlaySession) {
  if (!notesSortedByStart(notes)) {
    return playableWaitingNotes(notes, tracks, handSelection, session)
      .filter(note => Math.abs(note.start - startUs) <= CHORD_START_TOLERANCE_US)
  }

  const fromIndex = lowerBoundStart(notes, startUs - CHORD_START_TOLERANCE_US)
  const chord: SessionNote[] = []
  for (let index = fromIndex; index < notes.length; index += 1) {
    const note = notes[index]
    if (note.start > startUs + CHORD_START_TOLERANCE_US) break
    if (note.state === 'waiting' && isPlayableNote(note, tracks, handSelection, session)) chord.push(note)
  }
  return chord
}

export function findHit(notes: SessionNote[], tracks: TrackProperties[], handSelection: HandSelection, noteId: number, currentUs: number, session?: PlaySession) {
  let best: SessionNote | null = null
  let bestDistance = Infinity
  const earliestStart = findEarliestPlayableWaitingStart(notes, tracks, handSelection, session)
  if (earliestStart === null) return null

  for (const note of collectChordAtStart(notes, tracks, handSelection, earliestStart, session)) {
    if (note.noteId !== noteId) continue
    const distance = Math.abs(note.start - currentUs)
    if (distance <= HIT_WINDOW_US && distance < bestDistance) { best = note; bestDistance = distance }
  }
  return best
}

export function markMisses(notes: SessionNote[], tracks: TrackProperties[], handSelection: HandSelection, currentUs: number, session?: PlaySession) {
  const missed: SessionNote[] = []
  const profileEnabled = isPlaybackProfilerEnabled()
  let scannedNotes = 0

  if (!session || !notesSortedByStart(notes)) {
    for (const note of notes) {
      scannedNotes += 1
      if (isPlayableNote(note, tracks, handSelection, session) && note.state === 'waiting' && currentUs > note.start + HIT_WINDOW_US) {
        note.state = 'missed'
        missed.push(note)
      }
    }
    if (profileEnabled) {
      addActivePlaybackCounter('simulation', 'markMissesScanned', scannedNotes)
      addActivePlaybackCounter('simulation', 'markMissesMissed', missed.length)
      setActivePlaybackGauge('simulation', 'markMissesUsedSortedPath', 0)
    }
    return missed
  }

  const key = playableKey(tracks, handSelection, session)
  const cached = missCursorCache.get(session)
  const shouldReset = !cached || cached.notes !== notes || cached.lastUs > currentUs || cached.key !== key
  const state = shouldReset ? { notes, cursor: 0, lastUs: currentUs, key } : cached
  if (shouldReset) missCursorCache.set(session, state)

  while (state.cursor < notes.length) {
    const note = notes[state.cursor]
    scannedNotes += 1
    if (currentUs <= note.start + HIT_WINDOW_US) break
    if (note.state === 'waiting' && isPlayableNote(note, tracks, handSelection, session)) {
      note.state = 'missed'
      missed.push(note)
    }
    state.cursor += 1
  }
  state.lastUs = currentUs
  if (profileEnabled) {
    addActivePlaybackCounter('simulation', 'markMissesScanned', scannedNotes)
    addActivePlaybackCounter('simulation', 'markMissesMissed', missed.length)
    setActivePlaybackGauge('simulation', 'markMissesUsedSortedPath', 1)
    setActivePlaybackGauge('simulation', 'markMissesCursorReset', shouldReset ? 1 : 0)
  }
  return missed
}
