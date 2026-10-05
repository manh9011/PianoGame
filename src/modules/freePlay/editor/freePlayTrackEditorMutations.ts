import type { FreePlayRecordedNote, FreePlayTrack } from '../../../stores/freePlayStore'
import { clampPitch, FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US } from './freePlayTrackEditorGeometry'

export function cloneTrackEditorTracks(tracks: FreePlayTrack[]) {
  return tracks.map(track => ({ ...track, notes: track.notes.map(note => ({ ...note })) }))
}

export function sortTrackEditorNotes(notes: FreePlayRecordedNote[]) {
  notes.sort((left, right) => left.startUs - right.startUs || left.noteId - right.noteId || left.endUs - right.endUs)
}

function intervalsOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return leftStart < rightEnd && leftEnd > rightStart
}

function normalizeDraftNote(note: FreePlayRecordedNote) {
  note.trackId = Math.max(1, Math.round(note.trackId))
  note.noteId = clampPitch(note.noteId)
  note.velocity = Math.max(1, Math.min(127, Math.round(note.velocity)))
  note.startUs = Math.max(0, Math.round(note.startUs))
  note.endUs = Math.max(note.startUs + FREE_PLAY_EDITOR_MIN_NOTE_DURATION_US, Math.round(note.endUs))
}

export function canPlaceTrackEditorNotes(tracks: FreePlayTrack[], proposals: FreePlayRecordedNote[], excludeIds = new Set<string>()) {
  const proposedIds = new Set(proposals.map(note => note.id))

  for (let index = 0; index < proposals.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < proposals.length; otherIndex += 1) {
      const left = proposals[index]
      const right = proposals[otherIndex]
      if (left.noteId !== right.noteId) continue
      if (intervalsOverlap(left.startUs, left.endUs, right.startUs, right.endUs)) return false
    }
  }

  for (const proposal of proposals) {
    for (const track of tracks) {
      for (const note of track.notes) {
        if (excludeIds.has(note.id) || proposedIds.has(note.id)) continue
        if (note.noteId !== proposal.noteId) continue
        if (intervalsOverlap(proposal.startUs, proposal.endUs, note.startUs, note.endUs)) return false
      }
    }
  }

  return true
}

export function mutateTrackEditorNotes(
  tracks: FreePlayTrack[],
  noteIds: string[],
  updater: (note: FreePlayRecordedNote) => Partial<FreePlayRecordedNote> | void,
) {
  const selectedIds = new Set(noteIds)
  if (!selectedIds.size) return null

  const nextTracks = cloneTrackEditorTracks(tracks)
  const targetTrackIds = new Set(nextTracks.map(track => track.id))
  const proposals: FreePlayRecordedNote[] = []

  for (const track of nextTracks) {
    const keptNotes: FreePlayRecordedNote[] = []
    for (const note of track.notes) {
      if (!selectedIds.has(note.id)) {
        keptNotes.push(note)
        continue
      }

      const proposal: FreePlayRecordedNote = { ...note }
      const patch = updater(proposal)
      if (patch) Object.assign(proposal, patch)
      normalizeDraftNote(proposal)
      if (!targetTrackIds.has(proposal.trackId)) return null
      proposals.push(proposal)
    }
    track.notes = keptNotes
  }

  if (!proposals.length) return null
  if (!canPlaceTrackEditorNotes(nextTracks, proposals, selectedIds)) return null

  for (const proposal of proposals) {
    const targetTrack = nextTracks.find(track => track.id === proposal.trackId)
    if (!targetTrack) return null
    targetTrack.notes.push(proposal)
  }

  for (const track of nextTracks) sortTrackEditorNotes(track.notes)
  return nextTracks
}
