<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useToastStore } from '../stores/toastStore'
import { isTauri } from '@tauri-apps/api/core'

import { loadTranskunBuffers, type TranskunBuffers } from '../modules/transkun/buffers'
import { TranskunModel, TranskunHeadsModel } from '../modules/transkun/onnxModel'
import { TranskunTranscriber, type TranscribeProgress } from '../modules/transkun/transcriber'
import { loadAudioMono } from '../modules/transkun/audioLoad'
import { writeMidi } from '../modules/transkun/midiWriter'

const { t } = useI18n()
const router = useRouter()
const { confirm } = useConfirmDialog()
const toastStore = useToastStore()

const HF_BASE = 'https://huggingface.co/TuesdayCrowd/transkun-onnx/resolve/main/'

type Status = 'idle' | 'models' | 'decode' | 'transcribe' | 'done' | 'error'

const status = ref<Status>('idle')
const file = ref<File | null>(null)
const modelBase = ref(HF_BASE)
const showAdvanced = ref(false)
const logLines = ref<string[]>([])
const errorMessage = ref('')
const segDone = ref(0)
const segTotal = ref(0)
const stageLabel = ref('')
const noteCount = ref(0)
const midiUrl = ref<string | null>(null)
const midiFilename = ref('transcription.mid')
const durationSeconds = ref(0)
const elapsedSeconds = ref(0)
let timer: number | null = null

let buffersCache: TranskunBuffers | null = null
let modelCache: TranskunModel | null = null
let headsCache: TranskunHeadsModel | null = null
let modelBaseCached = ''

const stageNames: Record<TranscribeProgress['stage'], string> = {
  mel: 'Mel feature extraction',
  onnx: 'Running transformer model (ONNX)',
  viterbi: 'Semi-CRF decoding (Viterbi)',
  heads: 'Predicting velocity / auxiliary timing',
  merge: 'Merging segments'
}

const progressPercent = computed(() => (segTotal.value === 0 ? 0 : Math.round((segDone.value / segTotal.value) * 100)))
const isBusy = computed(() => status.value === 'models' || status.value === 'decode' || status.value === 'transcribe')

function log(line: string) {
  logLines.value.push(line)
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  resetResult()
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  if (f) {
    file.value = f
    resetResult()
  }
}

function resetResult() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  status.value = 'idle'
  logLines.value = []
  errorMessage.value = ''
  segDone.value = 0
  segTotal.value = 0
  stageLabel.value = ''
  noteCount.value = 0
  elapsedSeconds.value = 0
  if (midiUrl.value) URL.revokeObjectURL(midiUrl.value)
  midiUrl.value = null
}

async function ensureModels() {
  if (buffersCache && modelCache && headsCache && modelBaseCached === modelBase.value) {
    return { buffers: buffersCache, model: modelCache, heads: headsCache }
  }
  log(`Loading front-end buffers from ${modelBase.value} ...`)
  const buffers = await loadTranskunBuffers(modelBase.value)
  log(`Loaded params.json, mel filterbank [${buffers.params.rfftBins}×${buffers.params.nMels}], ${buffers.windows.length} analysis windows, ${buffers.symbols.length} tracks.`)

  log('Loading transkun.onnx (transformer + semi-CRF scorer, ~53MB) ...')
  const model = new TranskunModel(modelBase.value + 'transkun.onnx')
  await model.load()
  log('transkun.onnx is ready.')

  log('Loading transkun-heads.onnx (velocity + aux timing, ~3.4MB) ...')
  const heads = new TranskunHeadsModel(modelBase.value + 'transkun-heads.onnx')
  await heads.load()
  log('transkun-heads.onnx is ready.')

  buffersCache = buffers
  modelCache = model
  headsCache = heads
  modelBaseCached = modelBase.value
  return { buffers, model, heads }
}

async function runTranscription() {
  if (!file.value) return
  resetResult()

  const startTime = performance.now()
  timer = window.setInterval(() => {
    elapsedSeconds.value = (performance.now() - startTime) / 1000
  }, 100)

  try {
    status.value = 'models'
    const { buffers, model, heads } = await ensureModels()

    status.value = 'decode'
    log(`Decoding audio "${file.value.name}" and resampling to ${buffers.params.fs} Hz, mono ...`)
    const audio = await loadAudioMono(file.value, buffers.params.fs)
    durationSeconds.value = audio.length / buffers.params.fs
    log(`Audio duration: ${durationSeconds.value.toFixed(1)}s (${audio.length.toLocaleString('en-US')} samples).`)

    status.value = 'transcribe'
    const transcriber = new TranskunTranscriber(buffers, model, heads)
    const result = await transcriber.transcribe(audio, (p) => {
      segDone.value = p.segmentsDone
      segTotal.value = p.segmentsTotal
      stageLabel.value = stageNames[p.stage]
    })

    const endTime = performance.now()
    const totalSec = (endTime - startTime) / 1000
    elapsedSeconds.value = totalSec

    log(`Decoding finished: ${result.notes.length} notes, ${result.pedal.length / 2} sustain pedal events.`)
    noteCount.value = result.notes.length

    const midiBytes = writeMidi(result.notes, result.pedal, buffers.params.fs)
    const blob = new Blob([midiBytes.slice().buffer as ArrayBuffer], { type: 'audio/midi' })
    midiUrl.value = URL.createObjectURL(blob)
    const base = file.value.name.replace(/\.[^.]+$/, '')
    midiFilename.value = `${base}.mid`

    status.value = 'done'
    log(`Completed in ${totalSec.toFixed(1)}s. MIDI file is ready for download.`)
  } catch (err) {
    console.error(err)
    errorMessage.value = err instanceof Error ? err.message : String(err)
    status.value = 'error'
  } finally {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

function showHelp() {
  confirm({
    title: t('transcription.helpTitle'),
    message: t('transcription.helpMessage'),
    confirmLabel: t('common.close')
  })
}

function onDownloadClick() {
  if (isTauri()) {
    toastStore.showSuccess(t('transcription.downloadTauriToast'))
  }
}
</script>

<template>
  <div class="transcription-container">
    <header class="topbar">
      <BaseButton variant="secondary" @click="router.push('/')">
        {{ t('common.back') }}
      </BaseButton>
      <h1 class="title">{{ t('home.transcription') }} (BETA)</h1>
      <BaseButton variant="secondary" @click="showHelp">
        {{ t('play.help') }}
      </BaseButton>
    </header>

    <main class="content">
      <div class="transcription-card">
        <header class="card-header">
          <p class="subtitle">
            {{ t('transcription.subtitle') }}
          </p>
        </header>

        <section class="dropzone" :class="{ 'has-file': file, busy: isBusy }" @dragover.prevent @drop="onDrop">
          <label class="dropzone-label">
            <input type="file" accept=".wav,.mp3,.ogg,.flac,.m4a,audio/*" @change="onFileChange" :disabled="isBusy" />
            <template v-if="!file">
              <strong>{{ t('transcription.dropzoneChoose') }}</strong>
              <span>{{ t('transcription.dropzoneHint') }}</span>
            </template>
            <template v-else>
              <strong>{{ file.name }}</strong>
              <span>{{ t('transcription.dropzoneSelected', { size: (file.size / 1024 / 1024).toFixed(2) }) }}</span>
            </template>
          </label>
        </section>

        <div class="advanced-toggle">
          <button class="link-button" @click="showAdvanced = !showAdvanced" type="button">
            {{ showAdvanced ? t('transcription.hideAdvanced') : t('transcription.showAdvanced') }}
          </button>
        </div>
        <div v-if="showAdvanced" class="advanced-panel">
          <label class="field-label" for="model-base">{{ t('transcription.modelBaseUrl') }}</label>
          <BaseInput id="model-base" v-model="modelBase" :disabled="isBusy" />
          <p class="hint">
            {{ t('transcription.modelHintPart1') }}
            <a href="https://huggingface.co/TuesdayCrowd/transkun-onnx" target="_blank"
              rel="noopener">TuesdayCrowd/transkun-onnx</a>.
            <i18n-t keypath="transcription.modelHintPart2" tag="span">
              <template #path1>
                <code>public/models/transkun/</code>
              </template>
              <template #path2>
                <code>/models/transkun/</code>
              </template>
            </i18n-t>
          </p>
        </div>

        <BaseButton class="primary-button" variant="primary" :disabled="!file || isBusy" @click="runTranscription">
          <span v-if="!isBusy">{{ t('transcription.transcribeBtn') }}</span>
          <span v-else>{{ t('transcription.processingBtn') }}</span>
        </BaseButton>

        <section v-if="isBusy || logLines.length" class="progress-block">
          <div class="piano-progress" v-if="segTotal > 0">
            <div class="piano-progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <p v-if="stageLabel" class="stage-label">
            {{ t('transcription.segmentProgress', {
              stage: stageLabel, done: segDone, total: segTotal, percent:
                progressPercent,
              time: elapsedSeconds.toFixed(1) }) }}
          </p>
          <pre class="log">{{ logLines.join('\n') }}</pre>
        </section>

        <section v-if="status === 'error'" class="error-block">
          <strong>{{ t('transcription.errorOccurred') }}</strong>
          <p>{{ errorMessage }}</p>
        </section>

        <section v-if="status === 'done'" class="result-block">
          <div class="result-stats">
            <div class="stat-item">
              <span class="stat-value">{{ noteCount }}</span>
              <span class="stat-label">{{ t('transcription.statNotes') }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ durationSeconds.toFixed(1) }}s</span>
              <span class="stat-label">{{ t('transcription.statAudioDuration') }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ elapsedSeconds.toFixed(1) }}s</span>
              <span class="stat-label">{{ t('transcription.statProcessingTime') }}</span>
            </div>
          </div>
          <a v-if="midiUrl" class="download-button" :href="midiUrl" :download="midiFilename" @click="onDownloadClick">
            {{ t('transcription.downloadMidi', { filename: midiFilename }) }}
          </a>
        </section>

        <footer class="card-footer">
          <p>
            {{ t('transcription.footerText') }}
          </p>
        </footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
.transcription-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--color-bg-primary);
  overflow-y: auto;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border-subtle);
  position: sticky;
  top: 0;
  z-index: 10;
}

.title {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-text-primary);
}

.content {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.transcription-card {
  width: 100%;
  max-width: 720px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 14px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  height: fit-content;
}

.card-header {
  text-align: center;
}

.subtitle {
  color: var(--color-text-secondary);
  line-height: 1.6;
  font-size: 0.95rem;
  margin: 0;
}

.dropzone {
  border: 2px dashed var(--color-border-subtle);
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  transition: all 0.2s ease;
  background: var(--color-bg-primary);
}

.dropzone:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-hover);
}

.dropzone.has-file {
  border-color: var(--color-primary);
  background: var(--color-bg-hover);
}

.dropzone.busy {
  opacity: 0.6;
  pointer-events: none;
}

.dropzone-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
}

.dropzone-label input {
  display: none;
}

.dropzone-label strong {
  font-size: 1.1rem;
  color: var(--color-text-primary);
}

.dropzone-label span {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.advanced-toggle {
  display: flex;
  justify-content: flex-end;
}

.link-button {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-button:hover {
  color: var(--color-primary);
}

.advanced-panel {
  background: var(--color-bg-primary);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--color-border-subtle);
}

.field-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.hint {
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  margin: 4px 0 0;
  line-height: 1.5;
}

.hint a {
  color: var(--color-primary);
}

.primary-button {
  width: 100%;
  padding: 14px;
  font-size: 1.05rem;
}

.progress-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.piano-progress {
  height: 8px;
  border-radius: 4px;
  background: var(--color-bg-primary);
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
}

.piano-progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s ease;
}

.stage-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
}

.log {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 12px;
  font-family: monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  margin: 0;
}

.error-block {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 16px;
  color: #ef4444;
}

.error-block strong {
  display: block;
  margin-bottom: 8px;
}

.result-block {
  display: flex;
  flex-direction: column;
  gap: 20px;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 24px;
}

.result-stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--color-primary);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.download-button {
  display: block;
  text-align: center;
  background: var(--color-success, #10b981);
  color: white;
  border-radius: 8px;
  padding: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
}

.download-button:hover {
  background: var(--color-success-hover, #059669);
}

.card-footer {
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 0.8rem;
  line-height: 1.5;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 20px;
}
</style>
