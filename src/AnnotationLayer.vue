<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { AnnotationLayer } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs'
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist'

const props = defineProps<{
  imageResourcesPath?: string
  linkService: PDFLinkService | null
  page: PDFPageProxy
  viewport: PageViewport
}>()

const root = shallowRef<HTMLDivElement | null>(null)

onMounted(async () => {
  new AnnotationLayer({
    accessibilityManager: null,
    annotationCanvasMap: null,
    annotationEditorUIManager: null,
    div: root.value!,
    page: props.page,
    viewport: props.viewport,
  }).render({
    annotations: await props.page.getAnnotations(),
    div: root.value!,
    imageResourcesPath: props.imageResourcesPath,
    linkService: props.linkService!,
    page: props.page,
    renderForms: false,
    viewport: props.viewport,
  })
})
</script>

<template>
  <div ref="root" class="annotationLayer" />
</template>
