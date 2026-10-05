# PianoGame

PianoGame is a free, open-source piano learning and practice game for the web. It is inspired by Synthesia and brings the falling-notes experience to your browser and desktop - no sheet-music reading required to get started.

Anyone can jump in and play a song right away: falling-line visuals guide your hands, and you gradually pick up traditional notation as you go. Experienced players can use it to sight-read any MIDI or MusicXML file and to track progress with a detailed scoring and achievement system.

## Features

### Core gameplay
- **Falling-notes piano roll** rendered on canvas with a responsive on-screen piano keyboard
- **Four game modes:**
  - *Watch and Listen Only* - hands-free playback
  - *Practice the Melody* - playback waits until you play the correct note
  - *Practice the Rhythm* - scored practice with adjustable speed and pausing
  - *Song Recital* - full-speed, no pausing, no speed changes
- **Left / right / both hands** selection with independent background scorers per hand
- **Full scoring system:** 5 timing judgements (perfect → barely), 16 combo tiers with up to 2.5× bonus, hold-note points, speed tracking, and error penalty
- **Achievements** with per-song max score, breakdown by notes / holds / speed, celebration popups, and sounds

### Practice tools
- **Adjustable playback speed** from 10% to 400%, with lead-in duration and zoom (50–200%)
- **Loop regions** with automatic restart-after-errors, delay between loops, and per-loop score summaries
- **Metronome** with beat emphasis and double-speed click
- **Bookmarks** - user bookmarks, MIDI metadata markers, and key-signature bookmarks
- **Automatic fingering suggestions** via a DP-based algorithm in a Web Worker, with hand-size presets (XXS–XXL) and colored finger hints
- **Per-song statistics** and progress history per mode, per user profile

### Import and library
- **MIDI** (`.mid`, `.midi`, `.rmi`, `.rmid`) and **MusicXML** (`.musicxml`, `.xml`, `.mxl`) support
- **Automatic difficulty evaluation** on import
- **Local song library** with search, sorting, folders, preview, and batch import via the File System Access API
- **Online score library** - browse, search, and download community scores with async import jobs

### Audio and music intelligence
- **Web MIDI support** - connect any MIDI input/output device with auto-connect
- **Dual audio path:** direct MIDI output device preferred, with a built-in General MIDI synth fallback (FluidR3_GM soundfont, 128 instruments)
- **AI audio-to-MIDI transcription** - convert recordings (`.wav`, `.mp3`, `.ogg`, `.flac`, `.m4a`) into playable MIDI files, entirely in-browser via ONNX Runtime (detects sustain and soft pedals)
- **Realtime sheet music** - rendered as SVG via a music21 (Pyodide) → MusicXML → Verovio pipeline running in a Web Worker
- **Karaoke lyrics** synced to playback from MIDI lyric events
- **Realtime chord detection** with key-signature awareness

### Piano display and customization
- **8 label modes** for keys and notes (octaves, English/Fixed-Do/Movable-Do names, scale numbers, finger hints, virtual piano mapping, and more)
- **Flexible keyboard ranges:** 18 / 25 / 88 keys, custom ranges, song-only, or "my notes"
- **Per-track configuration:** auto-play / you-play / hidden / muted, instrument selection, automatic hand assignment by pitch, and multiple track color palettes
- **Dark and light themes**

### Companion features
- **Free Play mode:** record performances on up to 6 tracks, edit them in a full MIDI editor (draw/erase/select/marquee tools, snap, quantize, undo/redo), then export or import MIDI
- **Chord visualizer** for realtime input playback
- **Video export:** record your performance to MP4 or WebM, up to 4K (854×480 → 3840×2160), landscape or portrait, with custom background image and logo, rendered entirely offline in a Web Worker

### Platform support
- **Web (PWA)** - installable, works offline, deployable to any static host
- **Windows** - Electron (NSIS installer) and Tauri builds
- **macOS** - Electron builds (Intel x64 and Apple Silicon arm64, DMG)
- **Linux** - Tauri builds
- **Android** - Tauri APK builds (arm64-v8a, armeabi-v7a, x86, x86_64)

All release artifacts are built automatically via GitHub Actions.

### Localization
- **19 languages** with automatic detection and full RTL support for Arabic
- English, Spanish, Portuguese, French, German, Italian, Dutch, Vietnamese, Chinese, Japanese, Korean, Russian, Polish, Catalan, Thai, Turkish, and more - see `src/i18n/locales/`

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | Vue 3 (Composition API + `<script setup>`) |
| Language | TypeScript (strict) |
| Build | Vite |
| State | Pinia |
| Router | Vue Router (hash history) |
| i18n | vue-i18n (19 languages) |
| Desktop | Tauri v2, Electron |
| PWA | vite-plugin-pwa |
| CSS | Vanilla CSS + CSS variables (dark/light themes) |
| Audio | Web Audio API, Web MIDI, soundfont-player |
| MIDI parsing | @tonejs/midi |
| Sheet music | Verovio (WASM), music21 (Python via Pyodide WASM) |
| AI transcription | ONNX Runtime Web |
| Video export | mp4-muxer, webm-muxer (Web Workers) |
| Storage | IndexedDB |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- For desktop builds: [Rust](https://www.rust-lang.org/) with the Tauri v2 CLI

### Development

```sh
npm install
npm run dev
```

The dev server starts on `http://localhost:1420`.

### Production build

```sh
npm run build
```

This runs a typecheck (vue-tsc) followed by a Vite build into `dist/`. The output is PWA-ready and can be served from any static file host.

### Desktop builds

```sh
npm run tauri:dev              # Tauri dev mode
npm run tauri:build            # Build Tauri desktop app
npm run tauri:android:build    # Build Android APKs
```

### Electron builds

The Electron build compiles the app with Vite in electron mode first (`electron:build`), then packages it with electron-builder:

```sh
npm run electron:dist:win  # Build Windows installer (NSIS)
npm run electron:dist:mac  # Build macOS DMG
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (port 1420) |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | vue-tsc type check |
| `npm run preview` | Preview the production build |
| `npm run tauri:dev` | Tauri desktop dev mode |
| `npm run tauri:build` | Build the Tauri desktop app |
| `npm run tauri:android:build` | Build the Android APKs |
| `npm run electron:build` | Typecheck + Vite build in electron mode |
| `npm run electron:dist:win` | Build the Windows Electron installer (NSIS) |
| `npm run electron:dist:mac` | Build the macOS Electron DMG |

## Project Structure

```
PianoGame/
├── src/
│   ├── stores/          # Pinia state layer (player, library, settings, profiles...)
│   ├── views/           # Route-level pages (Home, Library, Play, Free Play...)
│   ├── components/      # Vue components (player canvas, dialogs, settings UI)
│   ├── modules/         # Pure-TS business logic (midi, audio, game, render, sheet...)
│   ├── workers/         # Web Workers (fingering, sheet music, video encoding)
│   ├── composables/     # Vue composables
│   ├── i18n/            # 19-language translation files
│   ├── types/           # Core TypeScript interfaces
│   └── styles/          # Global CSS with theme variables
├── src-tauri/           # Tauri v2 desktop app (Rust)
├── src-electron/        # Electron app (Windows/macOS)
└── public/              # Static assets (soundfonts, icons, key signature SVGs)
```

The core logic lives in `src/modules/` as framework-free TypeScript (MIDI pipeline, audio engine, game mechanics, rendering, sheet-music pipeline, storage), keeping it testable and reusable. CPU-heavy work (fingering, sheet music, video encoding) runs in dedicated Web Workers.

## Contributing

Contributions are welcome! Please open an issue first to discuss major changes. For a smooth review process:

1. Run `npm run typecheck` before submitting - the build must pass cleanly.
2. Any user-facing text must go through the i18n system (`src/i18n/locales/`) - no hardcoded strings.
3. Keep the existing code style and architecture.

## License

Copyright © 2026 manh9011. All rights reserved.
