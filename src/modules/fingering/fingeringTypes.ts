import type { Hand } from '../game/playSession'

export const HAND_SIZE_PRESETS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export type HandSizePreset = typeof HAND_SIZE_PRESETS[number]
export type FingerNumber = 1 | 2 | 3 | 4 | 5
export type FingeringSource = 'manual' | 'auto'

export interface HandSizeInfo {
  size: HandSizePreset
  factor: number
  relaxedThumbPinkySpanCm: number
}

export interface FingeringInputNote {
  id: string
  start: number
  end: number
  noteId: number
  hand: Hand
  finger?: FingerNumber | null
  fingerSource?: FingeringSource
}

export interface FingeringAssignment {
  noteId: string
  hand: Exclude<Hand, 'unknown'>
  finger: FingerNumber
  source: FingeringSource
  cost: number
}

export interface FingeringOptions {
  hand?: Exclude<Hand, 'unknown'> | 'both'
  handSize?: HandSizePreset
  depth?: number
  startUs?: number
  endUs?: number
  chordToleranceUs?: number
  chordNoteStaggerS?: number
}

export interface FingeringHandSummary {
  hand: Exclude<Hand, 'unknown'>
  noteCount: number
  assignmentCount: number
  costMin: number | null
  costMax: number | null
}

export interface FingeringResult {
  assignments: FingeringAssignment[]
  summaries: FingeringHandSummary[]
  handSize: HandSizePreset
}

export interface FingeringWorkerRequest {
  id: number
  notes: FingeringInputNote[]
  options?: FingeringOptions
}

export interface FingeringWorkerResponse {
  id: number
  result?: FingeringResult
  error?: string
}
