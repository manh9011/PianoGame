<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  cols?: number | string
  gap?: string | number
  alignItems?: 'start' | 'end' | 'center' | 'stretch'
  justifyItems?: 'start' | 'end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'
  tag?: string
}

const props = withDefaults(defineProps<Props>(), {
  cols: 1,
  gap: '1rem',
  alignItems: 'stretch',
  justifyItems: 'stretch',
  tag: 'div'
})

const gridStyle = computed(() => {
  let gridTemplateColumns = ''
  
  if (typeof props.cols === 'number') {
    gridTemplateColumns = `repeat(${props.cols}, 1fr)`
  } else if (typeof props.cols === 'string' && props.cols.trim() !== '') {
    const num = Number(props.cols)
    if (!isNaN(num) && num > 0) {
      gridTemplateColumns = `repeat(${num}, 1fr)`
    } else {
      gridTemplateColumns = props.cols
    }
  }

  const gapValue = typeof props.gap === 'number' ? `${props.gap}px` : props.gap

  return {
    display: 'grid',
    ...(gridTemplateColumns ? { gridTemplateColumns } : {}),
    gap: gapValue,
    alignItems: props.alignItems,
    justifyItems: props.justifyItems,
  }
})
</script>

<template>
  <component :is="tag" class="base-grid" :style="gridStyle">
    <slot />
  </component>
</template>

<style scoped>
.base-grid {
  display: grid;
}
</style>
