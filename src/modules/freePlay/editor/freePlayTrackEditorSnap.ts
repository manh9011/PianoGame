export type FreePlayEditorSubdivision = '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T' | '1/32'

export const FREE_PLAY_EDITOR_SUBDIVISIONS: FreePlayEditorSubdivision[] = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32']

const SUBDIVISION_FACTORS: Record<FreePlayEditorSubdivision, number> = {
  '1/4': 1,
  '1/8': 2,
  '1/8T': 3,
  '1/16': 4,
  '1/16T': 6,
  '1/32': 8,
}

export function quarterNoteUs(bpm: number) {
  return 60_000_000 / Math.max(1, bpm)
}

export function subdivisionUs(bpm: number, subdivision: FreePlayEditorSubdivision) {
  return quarterNoteUs(bpm) / SUBDIVISION_FACTORS[subdivision]
}

export function snapTimeUs(timeUs: number, bpm: number, subdivision: FreePlayEditorSubdivision, enabled: boolean) {
  const clamped = Math.max(0, timeUs)
  if (!enabled) return Math.round(clamped)
  const unit = subdivisionUs(bpm, subdivision)
  return Math.max(0, Math.round(Math.round(clamped / unit) * unit))
}
