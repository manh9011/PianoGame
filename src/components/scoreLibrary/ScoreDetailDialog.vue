<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '../ui/BaseDialog.vue'
import BaseButton from '../ui/BaseButton.vue'
import ScoreMidiPlayer from './ScoreMidiPlayer.vue'
import { formatDateTime } from '../../i18n/formatters'
import type { ScoreLibraryItem } from '../../types/scoreLibrary'
import type { SupportedLocale } from '../../i18n'

interface Props {
  show: boolean
  score: ScoreLibraryItem | null
  detailLoading: boolean
  midiBlob: Blob | null
  midiLoading: boolean
  playLoading: boolean
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

function fmtDate(iso: string): string {
  if (!iso) return ''
  return formatDateTime(new Date(iso), locale.value as SupportedLocale)
}

const emit = defineEmits<{
  close: []
  download: [score: ScoreLibraryItem]
  play: [score: ScoreLibraryItem]
  midiReady: [blob: Blob]
}>()

const midiPlayerRef = ref<InstanceType<typeof ScoreMidiPlayer> | null>(null)
const copiedLabel = ref<string | null>(null)

function onClose() {
  midiPlayerRef.value?.stopPlayback()
  emit('close')
}

function onMidiFetched(blob: Blob) {
  emit('midiReady', blob)
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedLabel.value = label
    setTimeout(() => { copiedLabel.value = null }, 1500)
  } catch {
    // fallback silently
  }
}

watch(() => props.show, (val) => {
  if (!val) {
    midiPlayerRef.value?.stopPlayback()
  }
})

onBeforeUnmount(() => {
  midiPlayerRef.value?.stopPlayback()
})
</script>

<template>
  <BaseDialog
    :show="show"
    :title="score?.title ?? ''"
    width="900px"
    @close="onClose"
  >
    <template v-if="score" #header-extra>
      <button class="sd-header-copy" :title="t('scoreLibrary.copy')" @click="copyText(score.title, 'title')">
        <i :class="copiedLabel === 'title' ? 'fa-solid fa-check' : 'fa-regular fa-copy'" />
      </button>
    </template>
    <div v-if="detailLoading" class="sd-loading">
      {{ t('scoreLibrary.loading') }}
    </div>
    <div v-else-if="score" class="sd-body">
      <div class="sd-left">
        <img :src="score.image" :alt="score.title" class="sd-image" />
      </div>
      <div class="sd-right">
        <div class="sd-meta">
          <div v-if="score.author" class="sd-meta-row">
            <span class="sd-meta-label">{{ t('scoreLibrary.metaAuthor') }}</span>
            <span class="sd-meta-value sd-selectable">{{ score.author }}</span>
            <button class="sd-copy-btn" :title="t('scoreLibrary.copy')" @click="copyText(score.author, 'author')"><i :class="copiedLabel === 'author' ? 'fa-solid fa-check' : 'fa-regular fa-copy'" /></button>
          </div>
          <div v-if="score.composer" class="sd-meta-row">
            <span class="sd-meta-label">{{ t('scoreLibrary.metaComposer') }}</span>
            <span class="sd-meta-value sd-selectable">{{ score.composer }}</span>
            <button class="sd-copy-btn" :title="t('scoreLibrary.copy')" @click="copyText(score.composer, 'composer')"><i :class="copiedLabel === 'composer' ? 'fa-solid fa-check' : 'fa-regular fa-copy'" /></button>
          </div>
          <div class="sd-meta-row">
            <span class="sd-meta-label">{{ t('scoreLibrary.metaCreated') }}</span>
            <span class="sd-meta-value">{{ fmtDate(score.created_date) }}</span>
          </div>
          <div class="sd-meta-row">
            <span class="sd-meta-label">{{ t('scoreLibrary.metaUpdated') }}</span>
            <span class="sd-meta-value">{{ fmtDate(score.updated_date) }}</span>
          </div>
          <div class="sd-meta-row">
            <span class="sd-meta-label">{{ t('scoreLibrary.metaViews') }}</span>
            <span class="sd-meta-value">{{ score.views }}</span>
          </div>
          <div class="sd-meta-row">
            <span class="sd-meta-label">{{ t('scoreLibrary.metaDownloads') }}</span>
            <span class="sd-meta-value">{{ score.downloads }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer bar -->
    <template v-if="score" #footer>
      <ScoreMidiPlayer
        ref="midiPlayerRef"
        :midi-blob="midiBlob"
        :loading="midiLoading"
        :user-id="score.user_id"
        :score-id="score.score_id"
        @midi-fetched="onMidiFetched"
      >
        <template #actions>
          <a
            class="sd-link-btn"
            :href="`https://musescore.com/user/${score.user_id}/scores/${score.score_id}`"
            target="_blank"
            rel="noopener noreferrer"
            :title="t('scoreLibrary.openOriginal')"
          >
            <i class="fa-solid fa-arrow-up-right-from-square" />
          </a>
          <BaseButton variant="icon" size="sm" :title="t('scoreLibrary.download')" @click="emit('download', score)">
            <i class="fa-solid fa-download" />
          </BaseButton>
          <BaseButton variant="icon" size="sm" :title="playLoading ? t('scoreLibrary.playPreparing') : t('scoreLibrary.play')" :disabled="playLoading" @click="emit('play', score)">
            <i :class="playLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-gamepad'" />
          </BaseButton>
        </template>
      </ScoreMidiPlayer>
    </template>
  </BaseDialog>
</template>

<style scoped>
.sd-body {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.sd-loading {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
}

.sd-left {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.sd-image {
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
  background: var(--color-bg-secondary);
}

.sd-right {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  align-self: flex-start;
}

.sd-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sd-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}

.sd-meta-label {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
  font-weight: 500;
}

.sd-meta-value {
  font-size: 0.88rem;
  color: var(--color-text-primary);
  text-align: right;
  word-break: break-word;
  flex: 1;
}

.sd-selectable {
  user-select: text;
}

.sd-copy-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}

.sd-copy-btn:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.sd-header-copy {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}

.sd-header-copy:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.sd-link-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}

.sd-link-btn:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 650px) {
  .sd-body {
    flex-direction: column;
  }
  .sd-right {
    flex: 0 0 auto;
  }
}
</style>
