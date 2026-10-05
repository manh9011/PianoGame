export interface MidiHeader { format: 0 | 1; trackCount: number; ticksPerQuarter: number }
export type MidiEventType = 'noteOn' | 'noteOff' | 'tempo' | 'timeSignature' | 'programChange' | 'channel'
export type MidiBookmarkSource = 'metadata' | 'keySignature' | 'midiMarker'
export interface MidiBookmarkEvent { pulse: number; source: MidiBookmarkSource; label: string; metaType?: string }
export interface MidiKeySignatureEvent { pulse: number; label: string; key?: string; scale?: string }
export interface MidiLyricEvent { pulse: number; text: string }
export interface RawMidiEvent { pulse: number; trackId: number; type: MidiEventType; channel?: number; noteId?: number; velocity?: number; tempo?: number; numerator?: number; denominator?: number; data?: number[] }
export interface MidiTrackInfo { trackId: number; channel: number; name?: string; instrumentProgram: number; instrumentName: string; instrumentFamily?: string; isPercussion?: boolean; noteCount: number }
export interface MidiFile { header: MidiHeader; events: RawMidiEvent[]; tracks: MidiTrackInfo[]; durationPulse: number; bookmarks: MidiBookmarkEvent[]; keySignatures: MidiKeySignatureEvent[]; lyrics: MidiLyricEvent[] }
export type NoteState = 'waiting' | 'hit' | 'missed' | 'active' | 'done'
export interface TranslatedNote { id: string; start: number; end: number; noteId: number; trackId: number; channel: number; velocity: number; state: NoteState }
export interface TranslatedControlChange { id: string; timeUs: number; trackId: number; channel: number; controllerNumber: number; value: number }
