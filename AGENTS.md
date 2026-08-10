# PianoGame — Tổng quan dự án

## Mô tả

PianoGame là ứng dụng học và luyện tập piano đa nền tảng, lấy cảm hứng từ Synthesia. Người dùng import file MIDI/MusicXML, chơi nhạc qua MIDI keyboard hoặc virtual piano với giao diện falling notes + sheet music, và theo dõi tiến trình qua hệ thống điểm số. Chạy trên Web (PWA) và Desktop (Tauri).

## Tech Stack

| Layer        | Công nghệ                                        |
| ------------ | ------------------------------------------------ |
| UI           | Vue 3 (Composition API + `<script setup>`)       |
| Ngôn ngữ     | TypeScript (strict)                              |
| Build        | Vite                                             |
| State        | Pinia                                            |
| Router       | Vue Router (hash history)                        |
| i18n         | vue-i18n (19 ngôn ngữ, RTL support)              |
| Desktop      | Tauri v2 (Rust)                                  |
| PWA          | vite-plugin-pwa (offline support)                |
| CSS          | Thuần CSS + CSS variables (dark/light theme)     |
| Audio        | Web Audio API, soundfont-player, SimpleSynth     |
| MIDI parse   | @tonejs/midi                                     |
| Sheet music  | Verovio (SVG), music21 (Python qua Pyodide WASM) |
| Video export | mp4-muxer, webm-muxer (Web Workers)              |
| Storage      | IndexedDB                                        |

## Cấu trúc thư mục

```
PianoGame/
├── index.html                        # Entry HTML
├── vite.config.ts                    # Vite + Vue + PWA config
├── package.json
├── agents.md                         # ← Hướng dẫn làm việc (file này)
│
├── public/                           # Static assets served as-is
│   ├── assets/                       # Key signature SVGs (0_C_Am.svg, ...)
│   ├── soundfonts/FluidR3_GM/        # Soundfont samples (mp3.js)
│   └── icons/                        # PWA icons
│
├── src/
│   ├── main.ts                       # App entry: init Pinia, i18n, hydrate stores, mount
│   ├── App.vue                       # Root: Toast + ConfirmDialog + RouterView + Analytics
│   ├── env.d.ts                      # Type declarations
│   │
│   ├── styles/
│   │   └── base.css                  # Global styles, CSS vars, dark/light theme
│   │
│   ├── types/                        # Core TypeScript interfaces
│   │   ├── song.ts                   # SongMetadata, SongSortKey
│   │   ├── profile.ts                # UserProfile, ModeScoreEntry, StoredTrackProperties...
│   │   └── settings.ts               # UserSettings (LabelMode, KeyboardRangeMode...)
│   │
│   ├── router/
│   │   └── index.ts                  # Routes: /, /library, /mode-select, /track-settings,
│   │                                  # /play, /record, /free-play, /settings/**
│   │
│   ├── i18n/
│   │   ├── index.ts                  # createI18n, locale detection (19 languages), RTL
│   │   ├── formatters.ts
│   │   └── locales/{en,vi,zh,...}.ts # Translation files (en.ts là source of truth)
│   │
│   ├── stores/                       # Pinia stores (state layer)
│   │   ├── playerStore.ts            # ⭐ Core playback engine (loadSong, noteInput, clock)
│   │   ├── libraryStore.ts           # Song library CRUD, import, preview, difficulty eval
│   │   ├── settingsStore.ts          # User settings persistence
│   │   ├── profileStore.ts           # User profiles, scores, fingerings, loop regions
│   │   ├── freePlayStore.ts          # Free Play recording, MIDI editor, state
│   │   ├── appStore.ts               # App-wide (e.g. navigation state)
│   │   ├── recordStore.ts            # Video render/export state
│   │   ├── toastStore.ts             # Toast + loading progress
│   │   └── confirmStore.ts           # Confirm dialogs
│   │
│   ├── views/                        # Route-level page components
│   │   ├── HomeView.vue              # Home: play, free-play, recent songs, profile
│   │   ├── LibraryView.vue           # Song list, search, sort, import, preview, details
│   │   ├── ModeSelectView.vue        # Mode selection (listen/melody/rhythm/performance)
│   │   ├── TrackSettingsView.vue     # Track config (hands, instruments, colors)
│   │   ├── PlayView.vue              # ⭐ Main gameplay view (piano roll + keyboard)
│   │   ├── RecordView.vue            # Video export preview
│   │   ├── FreePlayView.vue          # Free play recording + playback
│   │   ├── SettingView.vue           # Settings (w/ nested children)
│   │   └── settings/                 # Settings sub-views (music-devices, gameplay...)
│   │
│   ├── components/                   # Vue components
│   │   ├── home/                     # Home: RecentSongs, ProfileManager, LanguageDropup
│   │   ├── library/                  # Library: SongList, SongSortBar, FolderSelector, MidiImportButton
│   │   ├── player/                   # ⭐ Player components
│   │   │   ├── PianoKeyboard.vue     #    Canvas piano keyboard
│   │   │   ├── PianoRoll.vue         #    Canvas falling notes
│   │   │   ├── FreePlayPianoRoll.vue #    Free play variant
│   │   │   ├── PlayTopBar.vue        #    Transport controls
│   │   │   ├── TrackModeBar.vue      #    Track mode toggles
│   │   │   ├── ScorePanel.vue        #    Score display
│   │   │   ├── SheetMusicPanel.vue   #    Verovio sheet music SVG
│   │   │   ├── PerformanceTimeline.vue
│   │   │   ├── PerformanceOverlay.vue
│   │   │   ├── LoopControl.vue       #    Loop region controls
│   │   │   ├── GameplayFeedbackOverlay.vue
│   │   │   ├── AchievementCelebration.vue
│   │   │   ├── HelpOverlay.vue
│   │   │   ├── SongTitleIntroOverlay.vue
│   │   │   ├── RecordStageCanvas.vue #    Render export canvas
│   │   │   ├── FreePlayTrackManager.vue
│   │   │   ├── FreePlayTrackEditorGrid.vue
│   │   │   └── dialogs/              #    Sub-dialogs (Settings, TrackRole, Metronome,
│   │   │                                 Loop, Bookmarks, Finger, Labels, ColorPicker...)
│   │   ├── settings/                 # Settings widgets
│   │   │   ├── ThemeSettings.vue
│   │   │   ├── DisplaySettings.vue
│   │   │   ├── GameplaySettings.vue
│   │   │   ├── MidiDeviceSettings.vue
│   │   │   └── ui/                   # Settings layout (Sidebar, Section, Row, Toggle)
│   │   └── Toast.vue                 # Global toast notifications
│   │
│   ├── modules/                      # ⭐ Core business logic (pure TS, no Vue dependency)
│   │   ├── midi/                     # MIDI pipeline
│   │   │   ├── midiTypes.ts          #    MidiFile, TranslatedNote, event types
│   │   │   ├── midiParser.ts         #    @tonejs/midi wrapper → MidiFile
│   │   │   ├── midiNoteTranslator.ts #    MidiFile → TranslatedNote[]
│   │   │   ├── midiNotePairs.ts      #    Note naming (MIDI number → name)
│   │   │   ├── midiTempo.ts          #    Tempo map building, pulse→μs conversion
│   │   │   ├── midiPlayerClock.ts    #    ⭐ RAF-based playback clock with loop support
│   │   │   ├── midiHash.ts           #    MIDI content hashing
│   │   │   ├── midiDifficulty.ts     #    Auto difficulty evaluation
│   │   │   ├── webMidi.ts            #    Web MIDI API wrapper (requestAccess, send)
│   │   │   ├── freePlayMidiExport.ts #    Free Play → MIDI file export
│   │   │   └── midiNoteTranslator.ts
│   │   │
│   │   ├── audio/                    # Audio engine
│   │   │   ├── midiAssetPlayer.ts    #    Achievement sound playback
│   │   │   ├── autoNotePlayer.ts     #    ⭐ Auto-play notes via MIDI output or SimpleSynth
│   │   │   ├── simpleSynth.ts        #    Web Audio synth (soundfont-player wrapper)
│   │   │   ├── soundfontSource.ts    #    Soundfont URL resolution
│   │   │   ├── gmInstrumentCatalog.ts#    GM instrument program → name/family mapping
│   │   │   ├── metronomePlayer.ts    #    Metronome click track
│   │   │   └── notificationSound.ts  #    UI notification sounds
│   │   │
│   │   ├── game/                     # Game mechanics
│   │   │   ├── playSession.ts        #    ⭐ PlaySession type, PlayMode configs, session creation
│   │   │   ├── trackProperties.ts    #    Track modes/roles/colors, defaults
│   │   │   ├── handAssignment.ts     #    Auto hand split by pitch
│   │   │   ├── hitDetection.ts       #    Note hit detection, chord collection, miss marking
│   │   │   ├── scoring.ts            #    ⭐ Full scoring: timing, combo, holds, speed, grade
│   │   │   ├── scoreKeys.ts          #    Score tracking keys
│   │   │   ├── songStatistics.ts     #    Song play stats aggregation
│   │   │   ├── achievementScoring.ts #    Achievement computation
│   │   │   └── achievementColors.ts  #    Achievement color mapping
│   │   │
│   │   ├── render/                   # Canvas rendering engine
│   │   │   ├── pianoGeometry.ts      #    Piano key dimensions/geometry
│   │   │   ├── pianoRollLayout.ts    #    ⭐ Falling notes layout + caching
│   │   │   ├── hitLineRenderer.ts    #    Hit line rendering
│   │   │   ├── impactParticlesRenderer.ts
│   │   │   ├── pianoLabels.ts        #    Note/key label rendering modes
│   │   │   ├── canvasSpriteCache.ts  #    Canvas sprite caching
│   │   │   ├── keyboardRange.ts      #    Keyboard range calculation
│   │   │   └── record/               #    Render export scene
│   │   │       ├── recordSceneRenderer.ts
│   │   │       ├── pianoKeyboardRenderer.ts
│   │   │       ├── pianoRollRenderer.ts
│   │   │       └── recordRenderModel.ts
│   │   │
│   │   ├── renderExport/             # Video export pipeline
│   │   │   ├── exportTypes.ts
│   │   │   ├── offlineAudioRenderer.ts
│   │   │   ├── soundfontRenderer.ts
│   │   │   ├── videoEncoder.ts
│   │   │   ├── muxing.ts
│   │   │   └── renderExportClient.ts
│   │   │
│   │   ├── sheet/                    # Sheet music pipeline
│   │   │   ├── sheetTypes.ts         #    Sheet generation types/stages/errors
│   │   │   ├── sheetSource.ts        #    Data loading
│   │   │   ├── sheetPipeline.ts      #    ⭐ Pipeline orchestration
│   │   │   ├── sheetMusicClient.ts   #    Client for worker communication
│   │   │   ├── voiceStaffPartition.ts#    MIDI → voice/staff partition
│   │   │   ├── midiShardSerializer.ts#    MIDI shard serialization
│   │   │   ├── verovioLoader.ts      #    Verovio WASM loader
│   │   │   └── musicXmlMerge.ts      #    MusicXML merging
│   │   │
│   │   ├── musicxml/                 # MusicXML utilities
│   │   │   ├── musicXmlCompression.ts#    MXL compression/decompression
│   │   │   ├── musicXmlPlaybackCache.ts
│   │   │   └── musicXmlExportMetadata.ts
│   │   │
│   │   ├── fingering/                # Piano fingering engine
│   │   │   ├── fingeringTypes.ts     #    Fingering data types
│   │   │   ├── pianoFingering.ts     #    ⭐ DP-based fingering algorithm
│   │   │   └── fingeringClient.ts    #    Worker communication
│   │   │
│   │   ├── freePlay/                 # Free play logic
│   │   │   ├── freePlayMidiImport.ts #    MIDI → FreePlayTrack import
│   │   │   └── editor/               #    Track editor (snap, geometry, mutations)
│   │   │
│   │   ├── library/                  # Song library
│   │   │   ├── songLibrary.ts        #    IndexedDB CRUD, sort
│   │   │   ├── songImport.ts         #    File → ImportedSongCandidate
│   │   │   └── fileSystemAccess.ts   #    File System Access API wrapper
│   │   │
│   │   ├── settings/                 # Settings
│   │   │   ├── userSettings.ts       #    Settings CRUD + defaults
│   │   │   ├── profileStorage.ts     #    Profile CRUD
│   │   │   ├── storageKeys.ts        #    IndexedDB key constants
│   │   │   └── settingsNavigation.ts #    Settings nav tree
│   │   │
│   │   ├── storage/                  # Storage layer
│   │   │   ├── indexedDb.ts          #    ⭐ IndexedDB wrapper + PersistQueue
│   │   │   └── renderAssetStore.ts   #    Render asset storage
│   │   │
│   │   └── perf/                     # Performance profiler
│   │       └── playbackProfiler.ts   #    In-game FPS/ms profiling, span tracking
│   │
│   ├── workers/                      # Web Workers (offload CPU-heavy work)
│   │   ├── fingeringWorker.ts        # Fingering computation
│   │   ├── sheetMusicWorker.ts       # Sheet music generation (Pyodide + music21)
│   │   └── renderExportWorker.ts     # Video encoding
│   │
│   └── composables/                  # Vue composables
│       └── useConfirmDialog.ts
│
├── src-tauri/                        # Tauri desktop app (Rust)
│   ├── Cargo.toml
│   ├── build.rs
│   ├── src/main.rs + lib.rs
│   └── capabilities/default.json
│
└── dist/                             # Build output (PWA-ready)
```

## Routes chính

| Route                    | View                     | Chức năng                              |
| ------------------------ | ------------------------ | -------------------------------------- |
| `/`                      | HomeView.vue             | Màn hình chính, recent songs, profile  |
| `/library`               | LibraryView.vue          | Thư viện bài hát, import MIDI/MusicXML |
| `/mode-select/:hash?`    | ModeSelectView.vue       | Chọn chế độ chơi cho bài hát           |
| `/track-settings/:hash?` | TrackSettingsView.vue    | Cấu hình track (tay, nhạc cụ, màu)     |
| `/play/:hash/:modeId`    | PlayView.vue             | ⭐ Màn chơi chính                       |
| `/record/:hash`          | RecordView.vue           | Export video piano roll                |
| `/free-play`             | FreePlayView.vue         | Free play (thu âm + chỉnh sửa)         |
| `/settings/...`          | SettingView.vue (nested) | Cài đặt (7 sub-views)                  |

## Kiến trúc xử lý chính

### 1. Playback Engine (playerStore + MidiPlayerClock)
- **MidiPlayerClock**: RAF-based clock, hỗ trợ loop region, lead-in/lead-out
- **AutoNotePlayer**: Tự động phát nốt cho track `playedAutomatically` qua MIDI output hoặc SimpleSynth
- **SimpleSynth**: soundfont-player wrapper, fallback oscillator khi soundfont không tải được
- **Note Input Pipeline**: MIDI → noteInput() → findHit() → scoring → hold tracking

### 2. Game Modes
- `listen` — nghe tự động (không điểm)
- `noteMemory` — chờ người chơi đánh đúng nốt mới chạy tiếp
- `practice` — luyện tập, adjustable speed, tính điểm
- `performance` — thi đấu, 100% speed, không tua, không tạm dừng

### 3. Scoring System (scoring.ts)
- 5 timing judgements: perfect (50ms) → barely (330ms)
- Combo tiers: 16 tiers, bonus factor từ 1→2.5×
- Hold points: tick-based trong khi giữ nốt
- Speed tracking + error penalty
- Background scores riêng tay trái/phải

### 4. MIDI Pipeline
```
File MIDI → @tonejs/midi → RawMidiEvent[] → translateNotes → assignHands → PlaySession
```
- Sheet music nhánh riêng: MIDI → music21 (Pyodide WASM) → MusicXML → Verovio (WASM) → SVG

### 5. Free Play
- Ghi âm realtime (MIDI note on/off → timeline)
- MIDI Editor (grid-based: select/draw/erase/marquee, snap, quantize, undo/redo)
- Export MIDI, Import MIDI từ thư viện

### 6. Render Export
- Ghi piano roll animation → OffscreenCanvas → video frames
- OfflineAudioRenderer cho audio
- mp4-muxer / webm-muxer trong Web Worker

### 7. Storage
- IndexedDB: songs-metadata, songs-data, settings, profiles, app-state, render-assets
- PersistQueue: sequential writes, tránh race condition
- File System Access API: import folder MIDI hàng loạt

### 8. Sheet Music Pipeline
- Web Worker chạy Pyodide (Python WASM) + music21
- MIDI → voice/staff partition → music21 shard → MusicXML → Verovio → SVG
- Cache kết quả để tránh regenerate

## Scripts

| Script                        | Mô tả                    |
| ----------------------------- | ------------------------ |
| `npm run dev`                 | Dev server (port 1420)   |
| `npm run build`               | Type check + Vite build  |
| `npm run typecheck`           | vue-tsc type check       |
| `npm run preview`             | Preview production build |
| `npm run tauri:dev`           | Tauri dev mode           |
| `npm run tauri:build`         | Build Tauri desktop app  |
| `npm run tauri:android:build` | Build Android APK        |

## Các store và dependency graph

```
main.ts
├── libraryStore.hydrate()      # load songs từ IndexedDB
├── settingsStore.hydrate()     # load settings, set locale/theme
├── profileStore.hydrate()      # load profiles
├── freePlayStore.hydrate()     # load free play state
│
settingsStore ←── được dùng bởi ──→ playerStore, libraryStore
profileStore  ←── được dùng bởi ──→ playerStore (scores, fingerings)
playerStore   ←── orchestrate ──→ autoNotePlayer, metronomePlayer, SimpleSynth
libraryStore  ←── orchestrate ──→ songImport, songLibrary, MidiPlayerClock (preview)
freePlayStore ←── orchestrate ──→ freePlayMidiImport, editor
```

## Dependencies chính

| Package                        | Mục đích                        |
| ------------------------------ | ------------------------------- |
| vue 3 + vue-router             | UI framework + routing          |
| pinia                          | State management                |
| vue-i18n                       | Đa ngôn ngữ (19 languages)      |
| @tonejs/midi                   | MIDI file parsing               |
| soundfont-player               | Soundfont playback (FluidR3_GM) |
| verovio (WASM)                 | Sheet music SVG rendering       |
| music21 (Pyodide)              | MusicXML generation từ MIDI     |
| @tauri-apps/api + cli          | Tauri v2 desktop bridge         |
| vite-plugin-pwa                | PWA + service worker            |
| mp4-muxer + webm-muxer         | Video muxing cho render export  |
| uPlot                          | Charts (mode select breakdown)  |
| @fortawesome/fontawesome-free  | Icons                           |
| @infolektuell/noto-color-emoji | Emoji font                      |

## Lưu ý kiến trúc quan trọng

1. **Immutable note arrays**: `session.notes` luôn được map thành array mới khi mutate (trừ `note.state` được gán trực tiếp)
2. **Caching chiến lược**: pianoRollLayout dùng WeakMap cache, hitDetection có cursor-based cache, canvasSpriteCache cho render
3. **Audio dual-path**: MIDI output device ưu tiên, fallback về SimpleSynth (Web Audio)
4. **Performance**: playbackProfiler cho in-game diagnostics, reduce-animations mode
5. **Pure modules**: `src/modules/` không import Vue, chỉ TS thuần — dễ test và reuse
6. **Web Workers**: fingering, sheet music, video encoding — 3 workers riêng

## Environment

- Tôi sử dụng Windows. Khi cung cấp câu lệnh terminal, ưu tiên Command Prompt hoặc PowerShell; không sử dụng Bash trừ khi tôi yêu cầu.
- Không cần restore file `tsconfig.tsbuildinfo` sau khi build.
- Không tạo nhánh Git mới hoặc thay đổi workflow Git trừ khi tôi yêu cầu.

## Coding Guidelines

- Trước khi chỉnh sửa, hãy đọc và hiểu luồng xử lý hiện tại; ưu tiên mở rộng hoặc sửa trên kiến trúc sẵn có thay vì viết lại.
- Không thực hiện refactor lớn nếu tôi không yêu cầu.
- Không đổi tên biến, format code hoặc thay đổi style chỉ vì mục đích làm đẹp.
- Không thêm dependency mới nếu có thể giải quyết bằng thư viện hiện có.
- Chỉ tạo file mới khi thực sự cần thiết.
- Sau khi hoàn thành, kiểm tra và loại bỏ import, code hoặc file không còn được sử dụng.
- Không thêm comment giải thích các đoạn code hiển nhiên; chỉ comment khi logic phức tạp hoặc khó hiểu.
- **Bắt buộc**: Phải chạy typecheck (ví dụ: `npm run typecheck`) sau khi hoàn thành sửa code. Nếu có lỗi code, phải sửa sạch toàn bộ lỗi và lặp lại bước typecheck cho đến khi không còn lỗi nào.

## UI & Localization

- Toàn bộ text hiển thị trên giao diện phải sử dụng hệ thống i18n.
- Không được hard-code text trong component, template hoặc script.
- Khi thêm text mới, phải bổ sung key vào 19 file locale trong `src/i18n/locales/`.
- Mọi bản dịch phải chính xác và tự nhiên theo từng ngôn ngữ; không được sao chép nguyên văn tiếng Anh sang các locale khác.
- Trước khi hoàn thành task, nếu có thay đổi bên trong bất kỳ file nào trong `src/i18n/locales/` hãy thực hiện so sánh toàn bộ các key thuộc locale khác với locale gốc `en.ts` đảm bảo không thừa hay thiếu bất kỳ key nào.

## Project Maintenance

- Nếu có thay đổi lớn về kiến trúc dự án (thêm, xóa hoặc thay đổi cấu trúc thư mục chính trong `src` hoặc `src-tauri`) khiến tài liệu này không còn đúng, hãy đề xuất cập nhật `AGENTS.md` và `CLAUDE.md`.
- Khi ghi file văn bản, giữ nguyên mã hóa UTF-8; không tự động escape Unicode thành dạng `\uXXXX` trừ khi định dạng file yêu cầu.

## Safety

- Trước khi thực thi hoặc đề xuất các lệnh có khả năng thay đổi hệ thống, ghi đè hoặc xóa dữ liệu, hãy kiểm tra tính an toàn và giải thích rõ tác động.
- Nếu yêu cầu không rõ ràng hoặc có nhiều hướng triển khai hợp lý, hãy hỏi lại trước khi thực hiện thay vì tự suy đoán.