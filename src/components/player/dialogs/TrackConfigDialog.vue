<script setup lang="ts">
import BasePopover from '../../ui/BasePopover.vue'
import TrackConfigPanel from '../track-config/TrackConfigPanel.vue'

interface Props {
  show: boolean
  popupStyle?: { top: string; left: string }
  arrowStyle?: { top: string; left?: string; right?: string }
  arrowPlacement?: 'left' | 'right'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <BasePopover
    :show="show"
    :popup-style="props.popupStyle"
    :arrow-style="props.arrowStyle"
    :arrow-placement="props.arrowPlacement"
    width="420px"
    @close="emit('close')"
  >
    <TrackConfigPanel />
  </BasePopover>
</template>

<style scoped>
</style>
