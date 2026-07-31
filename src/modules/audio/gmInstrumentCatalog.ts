export enum InstrumentFamily {
  Piano = 'Piano',
  ChromaticPercussion = 'Chromatic Percussion',
  Organ = 'Organ',
  Guitar = 'Guitar',
  Bass = 'Bass',
  Strings = 'Strings',
  Ensemble = 'Ensemble',
  Brass = 'Brass',
  Reed = 'Reed',
  Pipe = 'Pipe',
  SynthLead = 'Synth Lead',
  SynthPad = 'Synth Pad',
  SynthEffects = 'Synth Effects',
  Ethnic = 'Ethnic',
  Percussive = 'Percussive',
  SoundEffects = 'Sound Effects',
}

export enum InstrumentDisplayFamily {
  Piano = 'Piano',
  ChromaticPercussion = 'Chromatic Percussion',
  Organ = 'Organ',
  Guitar = 'Guitar',
  Bass = 'Bass',
  Strings = 'Strings',
  Ensemble = 'Ensemble',
  Brass = 'Brass',
  Reed = 'Reed',
  Pipe = 'Pipe',
  Vocal = 'Vocal',
  SynthLead = 'Synth Lead',
  SynthPad = 'Synth Pad',
  SynthEffects = 'Synth Effects',
  Ethnic = 'Ethnic',
  Percussion = 'Percussion',
  SoundEffects = 'Sound Effects',
}

export enum InstrumentVisualFamily {
  Keys = 'keys',
  OrganKeys = 'organ-keys',
  Guitar = 'guitar',
  Strings = 'strings',
  Harp = 'harp',
  Ensemble = 'ensemble',
  Brass = 'brass',
  Reed = 'reed',
  Pipe = 'pipe',
  Vocal = 'vocal',
  Percussion = 'percussion',
  SynthLead = 'synth-lead',
  SynthPad = 'synth-pad',
  SynthEffects = 'synth-effects',
  Ethnic = 'ethnic',
  SoundEffects = 'sound-effects',
  Accordion = 'accordion',
}



export interface InstrumentOption {
  program: number
  name: string
  family: InstrumentFamily
  displayFamily: InstrumentDisplayFamily
  visualFamily: InstrumentVisualFamily
  soundfontId: string
}

export interface InstrumentGroup {
  family: string
  items: InstrumentOption[]
}

export const DEFAULT_INSTRUMENT_PROGRAM = 0

// Danh sách nhạc cụ đầy đủ để bạn tự sửa trực tiếp family / displayFamily / visualFamily / emoji / soundfontId.
export const GM_INSTRUMENTS: InstrumentOption[] = [
  { program: 0, name: 'Acoustic Grand Piano', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'acoustic_grand_piano' },
  { program: 1, name: 'Bright Acoustic Piano', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'bright_acoustic_piano' },
  { program: 2, name: 'Electric Grand Piano', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'electric_grand_piano' },
  { program: 3, name: 'Honky-Tonk Piano', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'honkytonk_piano' },
  { program: 4, name: 'Electric Piano 1', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'electric_piano_1' },
  { program: 5, name: 'Electric Piano 2', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'electric_piano_2' },
  { program: 6, name: 'Harpsichord', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'harpsichord' },
  { program: 7, name: 'Clavi', family: InstrumentFamily.Piano, displayFamily: InstrumentDisplayFamily.Piano, visualFamily: InstrumentVisualFamily.Keys, soundfontId: 'clavinet' },
  { program: 8, name: 'Celesta', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'celesta' },
  { program: 9, name: 'Glockenspiel', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'glockenspiel' },
  { program: 10, name: 'Music Box', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'music_box' },
  { program: 11, name: 'Vibraphone', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'vibraphone' },
  { program: 12, name: 'Marimba', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'marimba' },
  { program: 13, name: 'Xylophone', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'xylophone' },
  { program: 14, name: 'Tubular Bells', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'tubular_bells' },
  { program: 15, name: 'Dulcimer', family: InstrumentFamily.ChromaticPercussion, displayFamily: InstrumentDisplayFamily.ChromaticPercussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'dulcimer' },
  { program: 16, name: 'Drawbar Organ', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Organ, visualFamily: InstrumentVisualFamily.OrganKeys, soundfontId: 'drawbar_organ' },
  { program: 17, name: 'Percussive Organ', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Organ, visualFamily: InstrumentVisualFamily.OrganKeys, soundfontId: 'percussive_organ' },
  { program: 18, name: 'Rock Organ', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Organ, visualFamily: InstrumentVisualFamily.OrganKeys, soundfontId: 'rock_organ' },
  { program: 19, name: 'Church Organ', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Organ, visualFamily: InstrumentVisualFamily.OrganKeys, soundfontId: 'church_organ' },
  { program: 20, name: 'Reed Organ', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Organ, visualFamily: InstrumentVisualFamily.OrganKeys, soundfontId: 'reed_organ' },
  { program: 21, name: 'Accordion', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Organ, visualFamily: InstrumentVisualFamily.Accordion, soundfontId: 'accordion' },
  { program: 22, name: 'Harmonica', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'harmonica' },
  { program: 23, name: 'Tango Accordion', family: InstrumentFamily.Organ, displayFamily: InstrumentDisplayFamily.Organ, visualFamily: InstrumentVisualFamily.Accordion, soundfontId: 'tango_accordion' },
  { program: 24, name: 'Acoustic Guitar (Nylon)', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'acoustic_guitar_nylon' },
  { program: 25, name: 'Acoustic Guitar (Steel)', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'acoustic_guitar_steel' },
  { program: 26, name: 'Electric Guitar (Jazz)', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'electric_guitar_jazz' },
  { program: 27, name: 'Electric Guitar (Clean)', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'electric_guitar_clean' },
  { program: 28, name: 'Electric Guitar (Muted)', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'electric_guitar_muted' },
  { program: 29, name: 'Overdriven Guitar', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'overdriven_guitar' },
  { program: 30, name: 'Distortion Guitar', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'distortion_guitar' },
  { program: 31, name: 'Guitar Harmonics', family: InstrumentFamily.Guitar, displayFamily: InstrumentDisplayFamily.Guitar, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'guitar_harmonics' },
  { program: 32, name: 'Acoustic Bass', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'acoustic_bass' },
  { program: 33, name: 'Electric Bass (Finger)', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'electric_bass_finger' },
  { program: 34, name: 'Electric Bass (Pick)', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'electric_bass_pick' },
  { program: 35, name: 'Fretless Bass', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'fretless_bass' },
  { program: 36, name: 'Slap Bass 1', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'slap_bass_1' },
  { program: 37, name: 'Slap Bass 2', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'slap_bass_2' },
  { program: 38, name: 'Synth Bass 1', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'synth_bass_1' },
  { program: 39, name: 'Synth Bass 2', family: InstrumentFamily.Bass, displayFamily: InstrumentDisplayFamily.Bass, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'synth_bass_2' },
  { program: 40, name: 'Violin', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Strings, visualFamily: InstrumentVisualFamily.Strings, soundfontId: 'violin' },
  { program: 41, name: 'Viola', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Strings, visualFamily: InstrumentVisualFamily.Strings, soundfontId: 'viola' },
  { program: 42, name: 'Cello', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Strings, visualFamily: InstrumentVisualFamily.Strings, soundfontId: 'cello' },
  { program: 43, name: 'Contrabass', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Strings, visualFamily: InstrumentVisualFamily.Strings, soundfontId: 'contrabass' },
  { program: 44, name: 'Tremolo Strings', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Strings, visualFamily: InstrumentVisualFamily.Strings, soundfontId: 'tremolo_strings' },
  { program: 45, name: 'Pizzicato Strings', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Strings, visualFamily: InstrumentVisualFamily.Strings, soundfontId: 'pizzicato_strings' },
  { program: 46, name: 'Orchestral Harp', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Strings, visualFamily: InstrumentVisualFamily.Harp, soundfontId: 'orchestral_harp' },
  { program: 47, name: 'Timpani', family: InstrumentFamily.Strings, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'timpani' },
  { program: 48, name: 'String Ensemble 1', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Ensemble, soundfontId: 'string_ensemble_1' },
  { program: 49, name: 'String Ensemble 2', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Ensemble, soundfontId: 'string_ensemble_2' },
  { program: 50, name: 'Synthstrings 1', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Ensemble, soundfontId: 'synth_strings_1' },
  { program: 51, name: 'Synthstrings 2', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Ensemble, soundfontId: 'synth_strings_2' },
  { program: 52, name: 'Choir Aahs', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Vocal, soundfontId: 'choir_aahs' },
  { program: 53, name: 'Voice Oohs', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Vocal, soundfontId: 'voice_oohs' },
  { program: 54, name: 'Synth Voice', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Vocal, soundfontId: 'synth_choir' },
  { program: 55, name: 'Orchestra Hit', family: InstrumentFamily.Ensemble, displayFamily: InstrumentDisplayFamily.Ensemble, visualFamily: InstrumentVisualFamily.Ensemble, soundfontId: 'orchestra_hit' },
  { program: 56, name: 'Trumpet', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'trumpet' },
  { program: 57, name: 'Trombone', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'trombone' },
  { program: 58, name: 'Tuba', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'tuba' },
  { program: 59, name: 'Muted Trumpet', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'muted_trumpet' },
  { program: 60, name: 'French Horn', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'french_horn' },
  { program: 61, name: 'Brass Section', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'brass_section' },
  { program: 62, name: 'Synthbrass 1', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'synth_brass_1' },
  { program: 63, name: 'Synthbrass 2', family: InstrumentFamily.Brass, displayFamily: InstrumentDisplayFamily.Brass, visualFamily: InstrumentVisualFamily.Brass, soundfontId: 'synth_brass_2' },
  { program: 64, name: 'Soprano Sax', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'soprano_sax' },
  { program: 65, name: 'Alto Sax', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'alto_sax' },
  { program: 66, name: 'Tenor Sax', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'tenor_sax' },
  { program: 67, name: 'Baritone Sax', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'baritone_sax' },
  { program: 68, name: 'Oboe', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'oboe' },
  { program: 69, name: 'English Horn', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'english_horn' },
  { program: 70, name: 'Bassoon', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'bassoon' },
  { program: 71, name: 'Clarinet', family: InstrumentFamily.Reed, displayFamily: InstrumentDisplayFamily.Reed, visualFamily: InstrumentVisualFamily.Reed, soundfontId: 'clarinet' },
  { program: 72, name: 'Piccolo', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'piccolo' },
  { program: 73, name: 'Flute', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'flute' },
  { program: 74, name: 'Recorder', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'recorder' },
  { program: 75, name: 'Pan Flute', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'pan_flute' },
  { program: 76, name: 'Blown Bottle', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'blown_bottle' },
  { program: 77, name: 'Shakuhachi', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'shakuhachi' },
  { program: 78, name: 'Whistle', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'whistle' },
  { program: 79, name: 'Ocarina', family: InstrumentFamily.Pipe, displayFamily: InstrumentDisplayFamily.Pipe, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'ocarina' },
  { program: 80, name: 'Lead 1 (Square)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_1_square' },
  { program: 81, name: 'Lead 2 (Sawtooth)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_2_sawtooth' },
  { program: 82, name: 'Lead 3 (Calliope)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_3_calliope' },
  { program: 83, name: 'Lead 4 (Chiff)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_4_chiff' },
  { program: 84, name: 'Lead 5 (Charang)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_5_charang' },
  { program: 85, name: 'Lead 6 (Voice)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_6_voice' },
  { program: 86, name: 'Lead 7 (Fifths)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_7_fifths' },
  { program: 87, name: 'Lead 8 (Bass + Lead)', family: InstrumentFamily.SynthLead, displayFamily: InstrumentDisplayFamily.SynthLead, visualFamily: InstrumentVisualFamily.SynthLead, soundfontId: 'lead_8_bass__lead' },
  { program: 88, name: 'Pad 1 (New Age)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_1_new_age' },
  { program: 89, name: 'Pad 2 (Warm)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_2_warm' },
  { program: 90, name: 'Pad 3 (Polysynth)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_3_polysynth' },
  { program: 91, name: 'Pad 4 (Choir)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_4_choir' },
  { program: 92, name: 'Pad 5 (Bowed)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_5_bowed' },
  { program: 93, name: 'Pad 6 (Metallic)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_6_metallic' },
  { program: 94, name: 'Pad 7 (Halo)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_7_halo' },
  { program: 95, name: 'Pad 8 (Sweep)', family: InstrumentFamily.SynthPad, displayFamily: InstrumentDisplayFamily.SynthPad, visualFamily: InstrumentVisualFamily.SynthPad, soundfontId: 'pad_8_sweep' },
  { program: 96, name: 'Fx 1 (Rain)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_1_rain' },
  { program: 97, name: 'Fx 2 (Soundtrack)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_2_soundtrack' },
  { program: 98, name: 'Fx 3 (Crystal)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_3_crystal' },
  { program: 99, name: 'Fx 4 (Atmosphere)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_4_atmosphere' },
  { program: 100, name: 'Fx 5 (Brightness)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_5_brightness' },
  { program: 101, name: 'Fx 6 (Goblins)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_6_goblins' },
  { program: 102, name: 'Fx 7 (Echoes)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_7_echoes' },
  { program: 103, name: 'Fx 8 (Sci-Fi)', family: InstrumentFamily.SynthEffects, displayFamily: InstrumentDisplayFamily.SynthEffects, visualFamily: InstrumentVisualFamily.SynthEffects, soundfontId: 'fx_8_scifi' },
  { program: 104, name: 'Sitar', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Ethnic, soundfontId: 'sitar' },
  { program: 105, name: 'Banjo', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'banjo' },
  { program: 106, name: 'Shamisen', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Ethnic, soundfontId: 'shamisen' },
  { program: 107, name: 'Koto', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Ethnic, soundfontId: 'koto' },
  { program: 108, name: 'Kalimba', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Ethnic, soundfontId: 'kalimba' },
  { program: 109, name: 'Bag Pipe', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Pipe, soundfontId: 'bagpipe' },
  { program: 110, name: 'Fiddle', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Strings, soundfontId: 'fiddle' },
  { program: 111, name: 'Shanai', family: InstrumentFamily.Ethnic, displayFamily: InstrumentDisplayFamily.Ethnic, visualFamily: InstrumentVisualFamily.Ethnic, soundfontId: 'shanai' },
  { program: 112, name: 'Tinkle Bell', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'tinkle_bell' },
  { program: 113, name: 'Agogo', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'agogo' },
  { program: 114, name: 'Steel Drums', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'steel_drums' },
  { program: 115, name: 'Woodblock', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'woodblock' },
  { program: 116, name: 'Taiko Drum', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'taiko_drum' },
  { program: 117, name: 'Melodic Tom', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'melodic_tom' },
  { program: 118, name: 'Synth Drum', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'synth_drum' },
  { program: 119, name: 'Reverse Cymbal', family: InstrumentFamily.Percussive, displayFamily: InstrumentDisplayFamily.Percussion, visualFamily: InstrumentVisualFamily.Percussion, soundfontId: 'reverse_cymbal' },
  { program: 120, name: 'Guitar Fret Noise', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.Guitar, soundfontId: 'guitar_fret_noise' },
  { program: 121, name: 'Breath Noise', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.SoundEffects, soundfontId: 'breath_noise' },
  { program: 122, name: 'Seashore', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.SoundEffects, soundfontId: 'seashore' },
  { program: 123, name: 'Bird Tweet', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.SoundEffects, soundfontId: 'bird_tweet' },
  { program: 124, name: 'Telephone Ring', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.SoundEffects, soundfontId: 'telephone_ring' },
  { program: 125, name: 'Helicopter', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.SoundEffects, soundfontId: 'helicopter' },
  { program: 126, name: 'Applause', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.SoundEffects, soundfontId: 'applause' },
  { program: 127, name: 'Gunshot', family: InstrumentFamily.SoundEffects, displayFamily: InstrumentDisplayFamily.SoundEffects, visualFamily: InstrumentVisualFamily.SoundEffects, soundfontId: 'gunshot' },
]

const DISPLAY_INSTRUMENT_FAMILIES = [
  InstrumentDisplayFamily.Piano,
  InstrumentDisplayFamily.ChromaticPercussion,
  InstrumentDisplayFamily.Organ,
  InstrumentDisplayFamily.Guitar,
  InstrumentDisplayFamily.Bass,
  InstrumentDisplayFamily.Strings,
  InstrumentDisplayFamily.Ensemble,
  InstrumentDisplayFamily.Brass,
  InstrumentDisplayFamily.Reed,
  InstrumentDisplayFamily.Pipe,
  InstrumentDisplayFamily.Vocal,
  InstrumentDisplayFamily.SynthLead,
  InstrumentDisplayFamily.SynthPad,
  InstrumentDisplayFamily.SynthEffects,
  InstrumentDisplayFamily.Ethnic,
  InstrumentDisplayFamily.Percussion,
  InstrumentDisplayFamily.SoundEffects,
] as const

export function getInstrumentByProgram(program: number | undefined): InstrumentOption {
  return GM_INSTRUMENTS[program ?? DEFAULT_INSTRUMENT_PROGRAM] ?? GM_INSTRUMENTS[DEFAULT_INSTRUMENT_PROGRAM]
}





export function getInstrumentImageUrl(program: number): string {
  return `/instruments/${program}.png`
}

export function getInstrumentVisualFamily(instrument: InstrumentOption): InstrumentVisualFamily {
  return instrument.visualFamily
}

export function getInstrumentDisplayFamily(instrument: InstrumentOption): InstrumentDisplayFamily {
  return instrument.displayFamily
}

function sortInstrumentGroupItems(items: InstrumentOption[]): InstrumentOption[] {
  return [...items].sort((a, b) => a.program - b.program)
}

export const GM_INSTRUMENT_GROUPS: InstrumentGroup[] = DISPLAY_INSTRUMENT_FAMILIES
  .map(family => ({
    family,
    items: sortInstrumentGroupItems(GM_INSTRUMENTS.filter(instrument => instrument.displayFamily === family)),
  }))
  .filter(group => group.items.length > 0)

