import { Midi } from '@tonejs/midi'
import { parseMidi as parseRawMidi } from 'midi-file'
import type { MidiBookmarkEvent, MidiFile, MidiKeySignatureEvent, MidiLyricEvent, MidiTrackInfo, RawMidiEvent } from './midiTypes'
import { getInstrumentByProgram } from '../audio/gmInstrumentCatalog'

function titleCaseScale(scale?: string) {
  if (!scale) return 'Major'
  return `${scale.charAt(0).toUpperCase()}${scale.slice(1).toLowerCase()}`
}

function keySignatureLabel(key?: string, scale?: string) {
  const cleanKey = key?.trim() || 'C'
  return `${cleanKey} ${titleCaseScale(scale)}`
}

function pushBookmark(bookmarks: MidiBookmarkEvent[], event: MidiBookmarkEvent) {
  const label = event.label.trim()
  if (!label) return
  bookmarks.push({ ...event, label })
}

function dedupeBookmarks(bookmarks: MidiBookmarkEvent[]) {
  const seen = new Set<string>()
  return bookmarks
    .sort((a, b) => a.pulse - b.pulse || a.source.localeCompare(b.source) || a.label.localeCompare(b.label))
    .filter(bookmark => {
      const key = `${bookmark.pulse}:${bookmark.source}:${bookmark.label}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/**
 * @tonejs/midi only surfaces lyric meta events from track 0; karaoke MIDI
 * files usually keep lyrics on the melody track, so scan every track here.
 */
function collectLyricsFromAllTracks(buffer: ArrayBuffer): MidiLyricEvent[] {
  try {
    const raw = parseRawMidi(new Uint8Array(buffer))
    const out: MidiLyricEvent[] = []
    for (const track of raw.tracks) {
      let pulse = 0
      for (const event of track) {
        pulse += event.deltaTime
        if (event.type === 'lyrics' && event.text.trim()) out.push({ pulse, text: event.text })
      }
    }
    return out
  } catch {
    return []
  }
}

function dedupeLyrics(lyrics: MidiLyricEvent[]) {
  const seen = new Set<string>()
  return lyrics
    .sort((a, b) => a.pulse - b.pulse || a.text.localeCompare(b.text))
    .filter(lyric => {
      const key = `${lyric.pulse}:${lyric.text}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function parseMidi(buffer: ArrayBuffer): MidiFile {
  const midi = new Midi(buffer)

  const events: RawMidiEvent[] = []
  const tracks: MidiTrackInfo[] = []
  const bookmarks: MidiBookmarkEvent[] = []
  const keySignatures: MidiKeySignatureEvent[] = []
  const lyrics: MidiLyricEvent[] = collectLyricsFromAllTracks(buffer)
  let durationPulse = 0

  midi.tracks.forEach((track, trackId) => {
    const instrumentProgram = track.instrument?.number ?? 0
    const fallbackInstrument = getInstrumentByProgram(instrumentProgram)
    tracks.push({
      trackId,
      channel: track.channel ?? 0,
      name: track.name || undefined,
      instrumentProgram,
      instrumentName: track.instrument?.name ? titleCaseScale(track.instrument.name).replace(/\b\w/g, char => char.toUpperCase()) : fallbackInstrument.name,
      instrumentFamily: track.instrument?.family ?? fallbackInstrument.family,
      isPercussion: track.instrument?.percussion ?? track.channel === 9,
      noteCount: track.notes.length,
    })

    track.notes.forEach(note => {
      const startPulse = Math.round(note.ticks)
      const endPulse = Math.round(note.ticks + note.durationTicks)

      events.push({
        pulse: startPulse,
        trackId,
        type: 'noteOn',
        channel: track.channel,
        noteId: note.midi,
        velocity: Math.round(note.velocity * 127),
        data: [0x90 | track.channel, note.midi, Math.round(note.velocity * 127)]
      })

      events.push({
        pulse: endPulse,
        trackId,
        type: 'noteOff',
        channel: track.channel,
        noteId: note.midi,
        velocity: 0,
        data: [0x80 | track.channel, note.midi, 0]
      })

      durationPulse = Math.max(durationPulse, endPulse)
    })

    Object.entries(track.controlChanges).forEach(([ccNumber, changes]) => {
      changes.forEach(change => {
        const pulse = Math.round(change.ticks)
        events.push({
          pulse,
          trackId,
          type: 'channel',
          channel: track.channel,
          data: [0xb0 | track.channel, Number(ccNumber), change.value]
        })
      })
    })

    if (track.instrument) {
      events.push({
        pulse: 0,
        trackId,
        type: 'programChange',
        channel: track.channel,
        data: [0xc0 | track.channel, track.instrument.number]
      })
    }
  })

  midi.header.tempos.forEach(tempo => {
    const pulse = Math.round(tempo.ticks)
    const microsecondsPerBeat = Math.round(60000000 / tempo.bpm)
    events.push({
      pulse,
      trackId: 0,
      type: 'tempo',
      tempo: microsecondsPerBeat
    })
  })

  midi.header.timeSignatures.forEach(ts => {
    const pulse = Math.round(ts.ticks)
    events.push({
      pulse,
      trackId: 0,
      type: 'timeSignature',
      numerator: ts.timeSignature[0],
      denominator: ts.timeSignature[1]
    })
  })

  midi.header.keySignatures.forEach(signature => {
    const pulse = Math.round(signature.ticks)
    const label = keySignatureLabel(signature.key, signature.scale)
    keySignatures.push({ pulse, label, key: signature.key, scale: signature.scale })
    pushBookmark(bookmarks, { pulse, source: 'keySignature', label, metaType: 'keySignature' })
    durationPulse = Math.max(durationPulse, pulse)
  })

  midi.header.meta.forEach(meta => {
    const pulse = Math.round(meta.ticks)
    if (meta.type === 'marker') {
      pushBookmark(bookmarks, { pulse, source: 'midiMarker', label: meta.text, metaType: meta.type })
    } else if (meta.type === 'lyrics') {
      if (meta.text.trim()) lyrics.push({ pulse, text: meta.text })
    } else if (meta.type === 'text' || meta.type === 'cuePoint') {
      pushBookmark(bookmarks, { pulse, source: 'metadata', label: meta.text, metaType: meta.type })
    }
    durationPulse = Math.max(durationPulse, pulse)
  })

  events.sort((a, b) => a.pulse - b.pulse || a.trackId - b.trackId)
  keySignatures.sort((a, b) => a.pulse - b.pulse || a.label.localeCompare(b.label))

  return {
    header: {
      format: 1,
      trackCount: midi.tracks.length,
      ticksPerQuarter: midi.header.ppq
    },
    events,
    tracks,
    durationPulse,
    bookmarks: dedupeBookmarks(bookmarks),
    keySignatures,
    lyrics: dedupeLyrics(lyrics)
  }
}
