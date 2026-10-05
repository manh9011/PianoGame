<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseDialog from '../ui/BaseDialog.vue'

interface Props {
  show: boolean
}

defineProps<Props>()
const { t } = useI18n()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <BaseDialog
    :show="show"
    :title="t('scoreLibrary.helpTitle')"
    width="560px"
    @close="emit('close')"
  >
    <div class="sh-body">
      <section>
        <h4>{{ t('scoreLibrary.helpBrowsing') }}</h4>
        <p>{{ t('scoreLibrary.helpBrowsingText') }}</p>
      </section>
      <section>
        <h4>{{ t('scoreLibrary.helpSearching') }}</h4>
        <p>{{ t('scoreLibrary.helpSearchingText1') }}</p>
        <p>{{ t('scoreLibrary.helpSearchingText2') }}</p>
        <p>{{ t('scoreLibrary.helpSearchingText3') }}</p>
      </section>
      <section>
        <h4>{{ t('scoreLibrary.helpPreview') }}</h4>
        <p>{{ t('scoreLibrary.helpPreviewText') }}</p>
      </section>
      <section>
        <h4>{{ t('scoreLibrary.helpDownload') }}</h4>
        <p>{{ t('scoreLibrary.helpDownloadText') }}</p>
      </section>
      <section>
        <h4>{{ t('scoreLibrary.helpPlay') }}</h4>
        <p>{{ t('scoreLibrary.helpPlayText') }}</p>
      </section>
      <section>
        <h4>{{ t('scoreLibrary.helpImport') }}</h4>
        <p>{{ t('scoreLibrary.helpImportText') }}</p>
      </section>
    </div>
  </BaseDialog>
</template>

<style scoped>
.sh-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 0.88rem;
  color: var(--color-text-primary);
  line-height: 1.5;
}

.sh-body section h4 {
  margin: 0 0 4px 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sh-body section p {
  margin: 0;
  color: var(--color-text-secondary);
}

.sh-body section p + p {
  margin-top: 4px;
}
</style>
