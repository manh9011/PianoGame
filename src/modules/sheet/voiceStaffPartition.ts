import type { SheetNoteEvent, SheetSourceModel, SheetVoiceEvent, SheetVoicePlan } from './sheetTypes'

function quantizeTick(tick: number, grid: number) {
  return Math.max(0, Math.round(tick / grid) * grid)
}

function averagePitch(notes: SheetNoteEvent[]) {
  if (!notes.length) return 60
  return notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length
}

function assignStaffs(model: SheetSourceModel) {
  const noteTracks = model.tracks.filter(track => track.notes.length > 0)
  if (noteTracks.length === 1) {
    for (const note of noteTracks[0].notes) note.staff = note.pitch < 60 ? 2 : 1
    return
  }

  const sorted = [...noteTracks].sort((a, b) => averagePitch(b.notes) - averagePitch(a.notes))
  sorted.forEach((track, index) => {
    const staff = index === 0 ? 1 : averagePitch(track.notes) < 60 ? 2 : 1
    for (const note of track.notes) note.staff = staff
  })
}

function buildChordEvents(notes: SheetNoteEvent[], ppq: number): SheetVoiceEvent[] {
  const onsetTolerance = Math.max(1, Math.round(ppq / 96))
  const grid = Math.max(1, Math.round(ppq / 4))
  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick || b.endTick - a.endTick || a.pitch - b.pitch)
  const groups: SheetNoteEvent[][] = []

  for (const note of sorted) {
    const last = groups[groups.length - 1]
    const lastStart = last?.[0]?.startTick
    if (last && lastStart != null && Math.abs(note.startTick - lastStart) <= onsetTolerance) {
      last.push(note)
    } else {
      groups.push([note])
    }
  }

  const starts = groups.map(group => quantizeTick(group[0].startTick, grid))
  return groups.map((group, index) => {
    const startTick = starts[index]
    const rawEnd = Math.max(...group.map(note => note.endTick))
    let endTick = Math.max(startTick + grid, quantizeTick(rawEnd, grid))
    const nextStart = starts[index + 1]
    if (nextStart != null && nextStart > startTick) {
      const rawGap = nextStart - rawEnd
      if (rawGap > 0 && rawGap < grid) endTick = nextStart
      else endTick = Math.min(endTick, nextStart)
    }
    if (endTick <= startTick) endTick = startTick + grid

    return {
      startTick,
      endTick,
      channel: group[0].channel,
      velocity: Math.max(...group.map(note => note.velocity)),
      pitches: [...new Set(group.map(note => note.pitch))].sort((a, b) => a - b),
      sourceTrackIndexes: [...new Set(group.map(note => note.sourceTrackIndex))],
    }
  })
}

function partitionVoices(events: SheetVoiceEvent[]) {
  const voices: Array<{ availableAt: number; events: SheetVoiceEvent[] }> = []
  for (const event of events) {
    let selected = voices.find(voice => voice.availableAt <= event.startTick)
    if (!selected) {
      selected = { availableAt: 0, events: [] }
      voices.push(selected)
    }
    selected.events.push(event)
    selected.availableAt = event.endTick
  }
  return voices.map(voice => voice.events)
}

export function createVoicePlans(model: SheetSourceModel): SheetVoicePlan[] {
  assignStaffs(model)
  const plans: SheetVoicePlan[] = []
  const allNotes = model.tracks.flatMap(track => track.notes)

  for (const staff of [1, 2]) {
    const staffNotes = allNotes.filter(note => note.staff === staff)
    if (!staffNotes.length) continue
    const events = buildChordEvents(staffNotes, model.ppq)
    const voices = partitionVoices(events)
    const trackIndexes = [...new Set(staffNotes.map(note => note.sourceTrackIndex))]
    const firstTrack = model.tracks[trackIndexes[0]] ?? model.tracks[0]

    voices.forEach((voiceEvents, index) => {
      plans.push({
        id: index + 1,
        staff,
        clef: staff === 1 ? 'treble' : 'bass',
        name: `${staff === 1 ? 'RH' : 'LH'} Voice ${index + 1}`,
        channel: firstTrack?.channel ?? 0,
        program: firstTrack?.instrument.program ?? 0,
        events: voiceEvents,
        controls: trackIndexes.flatMap(trackIndex => model.tracks[trackIndex]?.controls ?? []),
        programs: trackIndexes.flatMap(trackIndex => model.tracks[trackIndex]?.programs ?? []),
        pitchBends: trackIndexes.flatMap(trackIndex => model.tracks[trackIndex]?.pitchBends ?? []),
      })
    })
  }

  return plans
}
