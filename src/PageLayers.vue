<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist'
import type { PDFLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs'

import AnnotationLayer from './AnnotationLayer.vue'
import BaseLayer from './BaseLayer.vue'
import TextLayer from './TextLayer.vue'

const props = defineProps<{
  annotationLayer?: boolean
  doc: PDFDocumentProxy
  height?: number
  id?: string
  imageResourcesPath?: string
  linkService: PDFLinkService | null
  page: number
  rotation: number
  scale: number
  textLayer?: boolean
  width?: number
}>()

const { devicePixelRatio } = window

const root = shallowRef<HTMLDivElement | null>(null)
const pageProxy = shallowRef<PDFPageProxy>()
const pageScale = shallowRef<number>()
const pageStyles = shallowRef<Record<string, string>>()
const pageViewport = shallowRef<PageViewport>()

/**
 * Returns an array of the actual page width and height based on props and
 * aspect ratio.
 * @param ratio - Page aspect ratio.
 */
const getPageDimensions = (ratio: number): [number, number] => {
  let width: number
  let height: number

  if (props.height && !props.width) {
    height = props.height
    width = height / ratio
  } else {
    width = props.width ?? root.value!.clientWidth
    height = width * ratio
  }

  return [width, height]
}

onMounted(async () => {
  const page = await props.doc.getPage(props.page)
  const pageRotation =
    ((props.rotation % 90 === 0 ? props.rotation : 0) + page.rotate) % 360
  const isTransposed = !!((pageRotation / 90) % 2)
  const [actualWidth, actualHeight] = getPageDimensions(
    isTransposed ? page.view[2] / page.view[3] : page.view[3] / page.view[2]
  )
  const pageWidth = isTransposed ? page.view[3] : page.view[2]

  pageProxy.value = page
  pageScale.value = actualWidth / pageWidth
  pageStyles.value = {
    width: `${Math.floor(actualWidth)}px`,
    height: `${Math.floor(actualHeight)}px`,
  }
  pageViewport.value = page.getViewport({
    scale: pageScale.value,
    rotation: pageRotation,
  })
})
</script>

<template>
  <div ref="root">
    <template v-if="pageProxy && pageViewport">
      <slot name="before-page" :page="page" />

      <div
        :id="id && `${id}-${page}`"
        class="vue-pdf-embed__page"
        :style="{
          '--scale-factor': pageScale,
        }"
      >
        <BaseLayer
          :page="pageProxy"
          :viewport="
            pageViewport.clone({
              scale: pageViewport.scale * devicePixelRatio * scale,
            })
          "
          :style="pageStyles"
        />

        <TextLayer
          v-if="textLayer"
          :page="pageProxy"
          :viewport="pageViewport.clone({ dontFlip: true })"
        />

        <AnnotationLayer
          v-if="annotationLayer"
          :page="pageProxy"
          :viewport="pageViewport.clone({ dontFlip: true })"
          :link-service="linkService"
        />
      </div>

      <slot name="after-page" :page="page" />
    </template>
  </div>
</template>
