<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist'

const props = defineProps<{
  page: PDFPageProxy
  viewport: PageViewport
}>()

const root = shallowRef<HTMLDivElement | null>(null)

onMounted(async () => {
  new TextLayer({
    container: root.value!,
    textContentSource: await props.page.getTextContent(),
    viewport: props.viewport,
  }).render()
})
</script>

<template>
  <div ref="root" class="textLayer" />
</template>
