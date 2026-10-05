import type { MidiFile } from '../midi/midiTypes'
import { buildTempoMap, pulseToMicroseconds } from '../midi/midiTempo'

export interface KaraokeWord { text: string; startUs: number; endUs: number; hardBreak?: boolean }
export interface KaraokeLine { id: string; text: string; startUs: number; endUs: number; words: KaraokeWord[] }

const SENTENCE_END_RE = /[.!?…;:,]$/
const SILENCE_GAP_US = 700_000 // 700ms+ silence counts as a breath/pause between lines
const MIN_WORDS_PER_LINE = 3
const OVERFLOW_SOFT_CHAR_LIMIT = 40
const BREAK_MARKERS = ['/', '\\']

export interface KaraokeSyllable { text: string; startUs: number; endUs?: number }

function collectSyllables(midi: MidiFile): KaraokeSyllable[] {
  const tempoMap = buildTempoMap(midi)
  // Lyric meta events carry no duration: resolve each syllable's end to the
  // note-off of the note starting at that same pulse.
  const endByOnset = new Map<number, number>()
  const openNotes = new Map<string, number>()
  for (const event of midi.events) {
    if (event.type === 'noteOn') {
      openNotes.set(`${event.trackId}:${event.channel ?? 0}:${event.noteId}`, event.pulse)
    } else if (event.type === 'noteOff') {
      const key = `${event.trackId}:${event.channel ?? 0}:${event.noteId}`
      const onset = openNotes.get(key)
      if (onset !== undefined) {
        openNotes.delete(key)
        const endUs = pulseToMicroseconds(event.pulse, midi.header.ticksPerQuarter, tempoMap)
        const prev = endByOnset.get(onset)
        if (prev === undefined || endUs > prev) endByOnset.set(onset, endUs)
      }
    }
  }

  const out: KaraokeSyllable[] = []
  for (const event of midi.lyrics) {
    const startUs = pulseToMicroseconds(event.pulse, midi.header.ticksPerQuarter, tempoMap)
    const pieces = event.text.split(/\r?\n/)
    pieces.forEach((piece, index) => {
      if (piece.trim()) out.push({ text: piece, startUs, endUs: endByOnset.get(event.pulse) })
      if (index < pieces.length - 1) out.push({ text: '\\', startUs })
    })
  }
  return out
}

/**
 * Each lyric event stays its own word — text kept as-is, no syllable merging.
 * "/" or "\" events force a line break after the previous word.
 */
function toWords(syllables: KaraokeSyllable[], durationUs: number): KaraokeWord[] {
  const sorted = [...syllables].sort((a, b) => a.startUs - b.startUs)
  const words: KaraokeWord[] = []

  for (const syllable of sorted) {
    const raw = syllable.text
    if (BREAK_MARKERS.includes(raw)) {
      if (words.length) words[words.length - 1] = { ...words[words.length - 1], hardBreak: true }
      continue
    }
    const text = raw.trim()
    if (!text) continue
    words.push({ text, startUs: syllable.startUs, endUs: syllable.endUs ?? -1 })
  }

  // Words with an explicit end (sung note duration) keep it so the highlight
  // only sweeps while the note is held; the rest stretch to the next word
  // start (or song end) as a fallback estimate.
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1]
    const explicit = words[i].endUs >= 0
    const endUs = explicit ? words[i].endUs : next ? next.startUs : durationUs
    words[i] = { ...words[i], endUs: Math.max(words[i].startUs + 1, endUs) }
  }
  return words
}

export function segmentKaraokeLines(words: KaraokeWord[]): KaraokeLine[] {
  const lines: KaraokeLine[] = []
  let current: KaraokeWord[] = []

  const flush = () => {
    if (current.length === 0) return
    lines.push({
      id: `line-${lines.length}`,
      text: current.map(w => w.text).join(' '),
      startUs: current[0].startUs,
      endUs: current[current.length - 1].endUs,
      words: current,
    })
    current = []
  }

  const currentTextLength = () => current.reduce((acc, w) => acc + w.text.length + 1, 0)

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const next = words[i + 1]
    current.push(word)

    if (word.hardBreak || SENTENCE_END_RE.test(word.text.trim())) {
      flush()
      continue
    }

    if (next) {
      const gapUs = next.startUs - word.endUs
      if (gapUs >= SILENCE_GAP_US && current.length >= MIN_WORDS_PER_LINE) {
        flush()
        continue
      }
    }

    if (currentTextLength() >= OVERFLOW_SOFT_CHAR_LIMIT) {
      flush()
    }
  }
  flush()
  return lines
}

export function buildKaraokeLines(midi: MidiFile, durationUs: number): KaraokeLine[] {
  if (midi.lyrics.length === 0) return []
  return buildKaraokeLinesFromSyllables(collectSyllables(midi), durationUs)
}
export function buildKaraokeLinesFromSyllables(syllables: KaraokeSyllable[], durationUs: number): KaraokeLine[] {
  if (syllables.length === 0) return []
  return segmentKaraokeLines(toWords(syllables, durationUs))
}

/**
 * Index of the line currently being sung, or the most-recently finished line
 * during silence (falls back to the first line before the song starts).
 * Returns -1 when there are no lines.
 */
export function findActiveKaraokeLineIndex(lines: KaraokeLine[], currentUs: number): number {
  if (lines.length === 0) return -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (currentUs >= line.startUs && currentUs <= line.endUs) return i
    if (line.startUs > currentUs) break
  }
  let mostRecent = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endUs <= currentUs) mostRecent = i
    else break
  }
  return mostRecent >= 0 ? mostRecent : 0
}
