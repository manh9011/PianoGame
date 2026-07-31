<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/ui/BaseButton.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'

const { t } = useI18n()
const router = useRouter()
const { confirm } = useConfirmDialog()

function showHelp() {
  confirm({
    title: t('transcription.helpTitle'),
    message: t('transcription.helpMessage'),
    confirmLabel: t('common.close')
  })
}
</script>

<template>
  <div class="transcription-container">
    <header class="topbar">
      <BaseButton variant="secondary" @click="router.push('/')">
        {{ t('common.back') }}
      </BaseButton>
      <h1 class="title">{{ t('home.transcription') }}</h1>
      <BaseButton variant="secondary" @click="showHelp">
        {{ t('play.help') }}
      </BaseButton>
    </header>
    <main class="content">
      <iframe src="https://transkun-web.vercel.app/" frameborder="0"
        sandbox="allow-scripts allow-same-origin allow-downloads" class="transkun-iframe"></iframe>
    </main>
  </div>
</template>

<style scoped>
.transcription-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--color-bg-primary);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: var(--color-bg-header);
  border-bottom: 1px solid var(--color-border-subtle);
}

.title {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-text-primary);
}

.content {
  flex: 1;
  display: flex;
}

.transkun-iframe {
  width: 100%;
  height: 100%;
}
</style>
