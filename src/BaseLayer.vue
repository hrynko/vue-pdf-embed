<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist'

import { releaseCanvas } from './utils'

const props = defineProps<{
  page: PDFPageProxy
  viewport: PageViewport
}>()

const root = shallowRef<HTMLCanvasElement | null>(null)

onMounted(() => {
  root.value!.width = props.viewport.width
  root.value!.height = props.viewport.height
  props.page.render({
    canvasContext: root.value!.getContext('2d')!,
    viewport: props.viewport,
  })
})

onBeforeUnmount(() => {
  releaseCanvas(root.value!)
})
</script>

<template>
  <canvas ref="root" />
</template>
