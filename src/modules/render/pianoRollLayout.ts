import type { TranslatedNote } from '../midi/midiTypes'
import { createPianoKeys, WHITE_KEY_COUNT } from './pianoGeometry'

const keyByNoteId = new Map(createPianoKeys().map(key => [key.noteId, key]))
const columnGeometryCache = new Map<string, { x: number; width: number }>()
let cachedViewportWidth = 0

export type LaidOutNote<T extends TranslatedNote = TranslatedNote> = T & { x: number; y: number; width: number; height: number }

interface NotesLayoutCache {
  maxDurationUs: number
  sortedByStart: boolean
  notesByEnd: TranslatedNote[]
}

const notesLayoutCache = new WeakMap<TranslatedNote[], NotesLayoutCache>()

function getNotesLayoutCache(notes: TranslatedNote[]): NotesLayoutCache {
  const cached = notesLayoutCache.get(notes)
  if (cached) return cached

  let maxDurationUs = 0
  let sortedByStart = true
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index]
    maxDurationUs = Math.max(maxDurationUs, note.end - note.start)
    if (index > 0 && note.start < notes[index - 1].start) sortedByStart = false
  }

  const next = {
    maxDurationUs,
    sortedByStart,
    notesByEnd: [...notes].sort((a, b) => a.end - b.end),
  }
  notesLayoutCache.set(notes, next)
  return next
}

function lowerBoundStart<T extends TranslatedNote>(notes: T[], startUs: number) {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (notes[mid].start < startUs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function upperBoundStart<T extends TranslatedNote>(notes: T[], startUs: number) {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (notes[mid].start <= startUs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function lowerBoundEnd<T extends TranslatedNote>(notes: T[], endUs: number) {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (notes[mid].end < endUs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function layoutNote<T extends TranslatedNote>(note: T, currentUs: number, windowUs: number, viewportWidth: number, viewportHeight: number): LaidOutNote<T> {
  const column = getNoteColumnGeometry(note.noteId, viewportWidth)
  const visibleStartUs = Math.max(note.start, currentUs)
  const visibleEndUs = Math.min(note.end, currentUs + windowUs)
  const y = viewportHeight - ((visibleStartUs - currentUs) / windowUs) * viewportHeight
  const visibleHeight = ((visibleEndUs - visibleStartUs) / windowUs) * viewportHeight
  return {
    ...note,
    x: column.x,
    width: column.width,
    y,
    height: Math.max(8, visibleHeight),
  }
}

function getNoteColumnGeometry(noteId: number, viewportWidth: number) {
  const roundedViewportWidth = Math.round(viewportWidth)
  if (roundedViewportWidth !== cachedViewportWidth) {
    columnGeometryCache.clear()
    cachedViewportWidth = roundedViewportWidth
  }

  const cacheKey = `${roundedViewportWidth}:${noteId}`
  const cached = columnGeometryCache.get(cacheKey)
  if (cached) return cached

  const unitWidth = viewportWidth / WHITE_KEY_COUNT
  const fallbackWidth = unitWidth * 0.8
  const key = keyByNoteId.get(noteId)
  const inset = key ? Math.min(unitWidth * key.width * 0.08, 2) : 0
  const geometry = {
    x: key ? key.x * unitWidth + inset : ((noteId - 21) / 87) * viewportWidth,
    width: Math.max(4, key ? key.width * unitWidth - inset * 2 : fallbackWidth),
  }
  columnGeometryCache.set(cacheKey, geometry)
  return geometry
}

export function layoutNotes<T extends TranslatedNote>(notes: T[], currentUs: number, showDuration: number, viewportWidth: number, viewportHeight: number): LaidOutNote<T>[] {
  const windowUs = showDuration * 1_000_000
  const viewEndUs = currentUs + windowUs
  const cache = getNotesLayoutCache(notes)

  if (!cache.sortedByStart) {
    return notes
      .filter(n => n.end >= currentUs && n.start <= viewEndUs)
      .map(n => layoutNote(n, currentUs, windowUs, viewportWidth, viewportHeight))
  }

  const result: LaidOutNote<T>[] = []
  const useEndIndex = cache.maxDurationUs > windowUs * 2
  if (useEndIndex) {
    const notesByEnd = cache.notesByEnd as T[]
    const fromEndIndex = lowerBoundEnd(notesByEnd, currentUs)
    const endCandidateCount = notesByEnd.length - fromEndIndex
    const startCandidateCount = upperBoundStart(notes, viewEndUs)

    if (endCandidateCount <= startCandidateCount) {
      for (let index = fromEndIndex; index < notesByEnd.length; index += 1) {
        const note = notesByEnd[index]
        if (note.start <= viewEndUs) result.push(layoutNote(note, currentUs, windowUs, viewportWidth, viewportHeight))
      }
      return result
    }

    for (let index = 0; index < startCandidateCount; index += 1) {
      const note = notes[index]
      if (note.end >= currentUs) result.push(layoutNote(note, currentUs, windowUs, viewportWidth, viewportHeight))
    }
    return result
  }

  const fromIndex = lowerBoundStart(notes, currentUs - cache.maxDurationUs)
  for (let index = fromIndex; index < notes.length; index += 1) {
    const note = notes[index]
    if (note.start > viewEndUs) break
    if (note.end >= currentUs) result.push(layoutNote(note, currentUs, windowUs, viewportWidth, viewportHeight))
  }
  return result
}
