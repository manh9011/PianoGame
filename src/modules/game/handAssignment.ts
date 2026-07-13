import type { TranslatedNote } from '../midi/midiTypes'
import type { Hand, SessionNote } from './playSession'

export const DEFAULT_HAND_SPLIT_NOTE_ID = 60
export const HAND_COLORS: Record<Hand, string> = {
  left: '#5B9BD5',
  right: '#4ADE80',
  unknown: '#888a85',
}
export const HAND_HIT_COLORS: Record<Hand, string> = {
  left: '#A8D1F2',
  right: '#A0F0C0',
  unknown: '#ffffff',
}

export function inferHandByPitch(noteId: number, splitNoteId = DEFAULT_HAND_SPLIT_NOTE_ID): Hand {
  return noteId < splitNoteId ? 'left' : 'right'
}

export interface HandAssignmentResult {
  notes: SessionNote[]
  needsManualAssignment: boolean
}

export function assignHands(notes: TranslatedNote[], splitNoteId = DEFAULT_HAND_SPLIT_NOTE_ID): HandAssignmentResult {
  const byTrack = new Map<number, TranslatedNote[]>()
  for (const note of notes) byTrack.set(note.trackId, [...(byTrack.get(note.trackId) ?? []), note])

  const trackStats = [...byTrack.entries()].map(([trackId, trackNotes]) => {
    const notesBelow = trackNotes.filter(n => n.noteId < splitNoteId).length
    const notesAbove = trackNotes.filter(n => n.noteId >= splitNoteId).length
    return {
      trackId,
      notes: trackNotes,
      totalNotes: trackNotes.length,
      notesBelow,
      notesAbove,
    }
  }).filter(t => t.totalNotes > 0)

  if (trackStats.length >= 2) {
    trackStats.sort((a, b) => b.totalNotes - a.totalNotes)
    const consideredTracks = trackStats.slice(0, Math.min(3, trackStats.length))

    const leftTrack = consideredTracks.reduce((best, curr) =>
      curr.notesBelow > best.notesBelow ? curr : best
    )
    const rightTrack = consideredTracks.reduce((best, curr) =>
      curr.notesAbove > best.notesAbove ? curr : best
    )

    if (leftTrack.trackId !== rightTrack.trackId) {
      const trackHands = new Map<number, Hand>([
        [leftTrack.trackId, 'left'],
        [rightTrack.trackId, 'right']
      ])
      return {
        notes: notes.map(note => ({
          ...note,
          hand: trackHands.get(note.trackId) ?? inferHandByPitch(note.noteId, splitNoteId)
        })),
        needsManualAssignment: false
      }
    }
  }

  return {
    notes: notes.map(note => ({ ...note, hand: inferHandByPitch(note.noteId, splitNoteId) })),
    needsManualAssignment: trackStats.length >= 2
  }
}

function median(values: number[]) {
  if (!values.length) return DEFAULT_HAND_SPLIT_NOTE_ID
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
