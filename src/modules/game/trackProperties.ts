import type { PlayMode } from './playSession'
import { DEFAULT_INSTRUMENT_PROGRAM } from '../audio/gmInstrumentCatalog'

export type TrackMode = 'playedAutomatically' | 'youPlay' | 'playedButHidden' | 'notPlayed'
export type HandAssignment = 'left' | 'right'
export type TrackRole = 'left' | 'right' | 'background'
export interface TrackProperties {
  trackId: number
  mode: TrackMode
  color: string
  hitColor: string
  blackColor: string
  handAssignment?: HandAssignment
  role?: TrackRole
  instrumentProgram: number
}
export interface TrackPropertyDefaults { trackId: number; instrumentProgram?: number; role?: TrackRole; percussion?: boolean }
export const TRACK_MODES: TrackMode[] = ['playedAutomatically', 'youPlay', 'playedButHidden', 'notPlayed']
export const TANGO_COLORS = ['#ef2929', '#f57900', '#fce94f', '#8ae234', '#729fcf', '#ad7fa8', '#e9b96e']
export const TRACK_SETTINGS_PALETTE = ['#729fcf', '#4e9a06', '#f57900', '#fce94f', '#ad7fa8', '#ef2929']
export const TRACK_INVISIBLE_COLOR = 'transparent'
export const TRACK_ROLE_COLORS = {
  left: '#729fcf',
  right: '#4e9a06',
} as const
export const MISSED_NOTE_COLOR = '#cc0000'
export const FLAT_GRAY = '#888a85'

function defaultTrackColor(role: TrackRole | undefined, index: number): string {
  if (role === 'left' || role === 'right') return TRACK_ROLE_COLORS[role]
  return TANGO_COLORS[index % TANGO_COLORS.length]
}

export function roleToHandAssignment(role: TrackRole | undefined): HandAssignment | undefined {
  return role === 'left' || role === 'right' ? role : undefined
}

export function roleToTrackMode(role: TrackRole | undefined, playMode: PlayMode): TrackMode {
  if (playMode === 'listen') return 'playedAutomatically'
  return role === 'background' ? 'playedAutomatically' : 'youPlay'
}

export function isTrackSounded(mode: TrackMode): boolean {
  return mode === 'playedAutomatically' || mode === 'youPlay'
}

export function isTrackVisible(mode: TrackMode): boolean {
  return mode !== 'notPlayed' && mode !== 'playedButHidden'
}

export function resolveTrackModeForSession(track: TrackProperties, playMode: PlayMode): TrackMode {
  if (track.mode === 'notPlayed' || track.mode === 'playedButHidden') return track.mode
  return roleToTrackMode(track.role, playMode)
}

export function isTrackRoleComplete(track: TrackProperties): boolean {
  return track.role === 'left' || track.role === 'right' || track.role === 'background'
}

export function isRoleIncludedInSheet(role: TrackRole | undefined): role is HandAssignment {
  return role === 'left' || role === 'right'
}

type SheetTrackSelectionSource = Array<Pick<TrackProperties, 'trackId' | 'role'>>

export function getSheetTrackIds(tracks: SheetTrackSelectionSource): number[] {
  return tracks
    .filter(track => isRoleIncludedInSheet(track.role))
    .map(track => track.trackId)
    .sort((a, b) => a - b)
}

export function getSheetTrackSelectionKey(tracks: SheetTrackSelectionSource): string {
  return tracks
    .filter(track => isRoleIncludedInSheet(track.role))
    .map(track => `${track.trackId}:${track.role}`)
    .sort((a, b) => a.localeCompare(b))
    .join('|')
}

export function createDefaultTrackProperties(trackIdsOrDefaults: Array<number | TrackPropertyDefaults>, percussionTracks = new Set<number>()): TrackProperties[] {
  return trackIdsOrDefaults.map((entry, i) => {
    const defaults = typeof entry === 'number' ? { trackId: entry } : entry
    const percussion = defaults.percussion ?? percussionTracks.has(defaults.trackId)
    const role = defaults.role ?? (percussion ? 'background' : undefined)
    return {
      trackId: defaults.trackId,
      mode: percussion ? 'playedButHidden' : roleToTrackMode(role, 'listen'),
      color: defaultTrackColor(role, i),
      hitColor: '#ffffff',
      blackColor: '#2e3436',
      handAssignment: roleToHandAssignment(role),
      role,
      instrumentProgram: defaults.instrumentProgram ?? DEFAULT_INSTRUMENT_PROGRAM,
    }
  })
}
