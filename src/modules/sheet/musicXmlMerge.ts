import { getEnglishNoteName } from '../render/pianoLabels'
import { SheetMusicError } from './sheetTypes'
import type { SheetShard } from './sheetTypes'

export interface ShardMusicXml {
  shard: SheetShard
  musicXml: string
}

interface MeasureState {
  divisions: number
  beats: number
  beatType: number
  fifths: number
}

interface ParsedPart {
  shard: SheetShard
  measures: string[]
}

function extractTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'i'))
  return match?.[0] ?? ''
}

function extractFirstPart(xml: string) {
  const withoutPartList = xml.replace(/<part-list\b[\s\S]*?<\/part-list>/i, '')
  const match = withoutPartList.match(/<part\s+id=(['"])[\s\S]*?\1\s*>[\s\S]*?<\/part>/i)
  return match?.[0] ?? ''
}

function extractMeasures(partXml: string) {
  return [...partXml.matchAll(/<measure\b[^>]*>[\s\S]*?<\/measure>/gi)].map(match => match[0])
}

function measureInner(measureXml: string) {
  return measureXml
    .replace(/^<measure\b[^>]*>/i, '')
    .replace(/<\/measure>\s*$/i, '')
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripForAdditionalVoice(inner: string) {
  return hideRests(inner)
    .replace(/<print\b[\s\S]*?<\/print>/gi, '')
    .replace(/<print\b[^/]*\/>/gi, '')
    .replace(/<attributes\b[\s\S]*?<\/attributes>/gi, '')
    .replace(/<direction\b[\s\S]*?<\/direction>/gi, '')
    .replace(/<barline\b[\s\S]*?<\/barline>/gi, '')
}

function hideRests(inner: string) {
  return inner.replace(/<note\b[^>]*>\s*<rest\b[\s\S]*?<\/note>/gi, noteXml => {
    if (/<print-object="no"/i.test(noteXml)) return noteXml
    return noteXml.replace(/<note\b/i, '<note print-object="no"')
  })
}

function stripBarlines(inner: string) {
  return inner
    .replace(/<barline\b[\s\S]*?<\/barline>/gi, '')
    .replace(/<barline\b[^/]*\/>/gi, '')
}

function finalBarline() {
  return '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
}

function hasPitchedNote(inner: string) {
  return /<pitch>\s*<step>/i.test(inner)
}

const pitchClassByStep: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

function alterForNoteName(name: string) {
  if (name.endsWith('bb')) return -2
  if (name.endsWith('b')) return -1
  if (name.endsWith('x')) return 2
  if (name.endsWith('#')) return 1
  return 0
}

function octaveForSpelling(midi: number, step: string, alter: number) {
  const spelledPitchClass = ((pitchClassByStep[step] ?? 0) + alter + 120) % 12
  return Math.floor((midi - spelledPitchClass) / 12) - 1
}

function respellPitch(step: string, alterText: string | undefined, octaveText: string, fifths: number) {
  const currentAlter = Number(alterText ?? 0)
  const octave = Number(octaveText)
  const pitchClass = ((pitchClassByStep[step] ?? 0) + currentAlter + 120) % 12
  const midi = (octave + 1) * 12 + pitchClass
  const noteName = getEnglishNoteName(midi, fifths)
  const nextStep = noteName[0]
  const nextAlter = alterForNoteName(noteName)
  const nextOctave = octaveForSpelling(midi, nextStep, nextAlter)
  const alterXml = nextAlter ? `<alter>${nextAlter}</alter>` : ''
  return `<pitch><step>${nextStep}</step>${alterXml}<octave>${nextOctave}</octave></pitch>`
}

function normalizeAccidentals(inner: string, fifths: number) {
  return inner
    .replace(
      /<pitch>\s*<step>\s*([A-G])\s*<\/step>\s*(?:<alter>\s*(-?\d+)\s*<\/alter>\s*)?<octave>\s*(-?\d+)\s*<\/octave>\s*<\/pitch>/gi,
      (_match, step: string, alter: string | undefined, octave: string) => respellPitch(step.toUpperCase(), alter, octave, fifths),
    )
    .replace(/\s*<accidental(?:\s+[^>]*)?>[\s\S]*?<\/accidental>/gi, '')
}

function forceVoiceNumber(inner: string, voice: number) {
  if (/<voice>\s*\d+\s*<\/voice>/i.test(inner)) {
    return inner.replace(/<voice>\s*\d+\s*<\/voice>/gi, `<voice>${voice}</voice>`)
  }
  return inner.replace(/(<note\b[^>]*>)/gi, `$1<voice>${voice}</voice>`)
}

function updateMeasureState(inner: string, state: MeasureState) {
  const divisions = inner.match(/<divisions>\s*(\d+)\s*<\/divisions>/i)?.[1]
  const beats = inner.match(/<beats>\s*(\d+)\s*<\/beats>/i)?.[1]
  const beatType = inner.match(/<beat-type>\s*(\d+)\s*<\/beat-type>/i)?.[1]
  const fifths = inner.match(/<fifths>\s*(-?\d+)\s*<\/fifths>/i)?.[1]
  if (divisions) state.divisions = Number(divisions)
  if (beats) state.beats = Number(beats)
  if (beatType) state.beatType = Number(beatType)
  if (fifths) state.fifths = Number(fifths)
}

function measureDuration(state: MeasureState) {
  return Math.max(1, Math.round(state.divisions * state.beats * (4 / state.beatType)))
}

function restMeasureInner(state: MeasureState) {
  return `<note><rest/><duration>${measureDuration(state)}</duration><voice>1</voice></note>`
}

function partNameForStaff(_staff: number) {
  return ''
}

function parseShardPart(item: ShardMusicXml): ParsedPart | null {
  const part = extractFirstPart(item.musicXml)
  if (!part) return null
  return { shard: item.shard, measures: extractMeasures(part) }
}

export function mergeShardMusicXml(shards: ShardMusicXml[]) {
  if (!shards.length) throw new SheetMusicError('sheetMusic.errors.noVoiceShard', 'noVoiceShard')

  const parsed = shards
    .map(parseShardPart)
    .filter((part): part is ParsedPart => !!part)
    .sort((a, b) => a.shard.staff - b.shard.staff || a.shard.voice - b.shard.voice)

  if (!parsed.length) throw new SheetMusicError('sheetMusic.errors.noMusicXmlPart', 'noMusicXmlPart')

  const first = shards[0].musicXml
  const declaration = first.match(/^<\?xml[\s\S]*?\?>/)?.[0] ?? '<?xml version="1.0" encoding="UTF-8"?>'
  const doctype = first.match(/<!DOCTYPE[\s\S]*?>/)?.[0] ?? ''
  const identification = extractTag(first, 'identification')
  const defaults = extractTag(first, 'defaults')
  const credit = extractTag(first, 'credit')
  const staffGroups = new Map<number, ParsedPart[]>()

  for (const part of parsed) {
    staffGroups.set(part.shard.staff, [...(staffGroups.get(part.shard.staff) ?? []), part])
  }

  const staffs = [...staffGroups.keys()].sort((a, b) => a - b)
  const partList = staffs.map(staff => {
    const partId = `P${staff}`
    return `<score-part id="${partId}"><part-name>${escapeXml(partNameForStaff(staff))}</part-name></score-part>`
  }).join('')
  const partGroup = staffs.length >= 2
    ? `<part-group type="start" number="1"><group-symbol>brace</group-symbol><group-barline>yes</group-barline></part-group>${partList}<part-group type="stop" number="1"/>`
    : partList

  const totalMeasures = Math.max(...parsed.map(part => part.measures.length))

  const parts = staffs.map(staff => {
    const voices = staffGroups.get(staff) ?? []
    const state: MeasureState = { divisions: 1, beats: 4, beatType: 4, fifths: 0 }
    const measures: string[] = []

    for (let index = 0; index < totalMeasures; index++) {
      const chunks: string[] = []
      const firstInner = measureInner(voices[0]?.measures[index] ?? `<measure number="${index + 1}"></measure>`)
      updateMeasureState(firstInner, state)

      const measureVoices = voices
        .map((voice, voiceIndex) => {
          const rawMeasure = voice.measures[index]
          if (!rawMeasure) return null
          const inner = measureInner(rawMeasure)
          return { voiceIndex, inner, hasNotes: hasPitchedNote(inner) }
        })
        .filter((voice): voice is { voiceIndex: number; inner: string; hasNotes: boolean } => !!voice)
      const usefulVoices = measureVoices.filter(voice => voice.hasNotes)
      const voicesToRender = usefulVoices.length ? usefulVoices : measureVoices.slice(0, 1)

      if (!voicesToRender.length) {
        chunks.push(restMeasureInner(state))
      }

      voicesToRender.forEach((voice, renderIndex) => {
        let inner = voice.inner
        if (renderIndex > 0) {
          inner = stripForAdditionalVoice(inner)
          chunks.push(`<backup><duration>${measureDuration(state)}</duration></backup>`)
        }
        inner = stripBarlines(inner)
        chunks.push(forceVoiceNumber(normalizeAccidentals(inner, state.fifths), renderIndex + 1))
      })

      if (index === totalMeasures - 1) chunks.push(finalBarline())
      measures.push(`<measure number="${index + 1}">${chunks.join('')}</measure>`)
    }

    return `<part id="P${staff}">${measures.join('')}</part>`
  }).join('')

  return `${declaration}\n${doctype}\n<score-partwise version="4.0">${credit}${identification}${defaults}<part-list>${partGroup}</part-list>${parts}</score-partwise>`
}
