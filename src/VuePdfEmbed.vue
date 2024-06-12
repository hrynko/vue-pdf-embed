<script setup lang="ts">
import { computed, shallowRef, toRef, watch } from 'vue'
import { PDFLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs'
import type { OnProgressParameters, PDFDocumentProxy } from 'pdfjs-dist'

import type { PasswordRequestParams, Source } from './types'
import {
  addPrintStyles,
  createPrintIframe,
  downloadPdf,
  releaseChildCanvases,
} from './utils'
import { useVuePdfEmbed } from './composables'
import PageLayers from './PageLayers.vue'

const props = withDefaults(
  defineProps<{
    /**
     * Whether to enable an annotation layer.
     */
    annotationLayer?: boolean
    /**
     * Desired page height.
     */
    height?: number
    /**
     * Root element identifier (inherited by page containers with page number
     * postfixes).
     */
    id?: string
    /**
     * Path for annotation icons, including trailing slash.
     */
    imageResourcesPath?: string
    /**
     * Number of the page to display.
     */
    page?: number
    /**
     * Desired page rotation angle.
     */
    rotation?: number
    /**
     * Desired ratio of canvas size to document size.
     */
    scale?: number
    /**
     * Source of the document to display.
     */
    source: Source
    /**
     * Whether to enable a text layer.
     */
    textLayer?: boolean
    /**
     * Desired page width.
     */
    width?: number
  }>(),
  {
    rotation: 0,
    scale: 1,
  }
)

const emit = defineEmits<{
  (e: 'internal-link-clicked', value: number): void
  (e: 'loaded', value: PDFDocumentProxy): void
  (e: 'loading-failed', value: Error): void
  (e: 'password-requested', value: PasswordRequestParams): void
  (e: 'progress', value: OnProgressParameters): void
}>()

const pageNums = shallowRef<number[]>([])

const { doc } = useVuePdfEmbed({
  onError: (e) => {
    pageNums.value = []
    emit('loading-failed', e)
  },
  onPasswordRequest({ callback, isWrongPassword }) {
    emit('password-requested', { callback, isWrongPassword })
  },
  onProgress: (progressParams) => {
    emit('progress', progressParams)
  },
  source: toRef(props, 'source'),
})

const linkService = computed(() => {
  if (!doc.value || !props.annotationLayer) {
    return null
  }

  const service = new PDFLinkService()
  service.setDocument(doc.value)
  service.setViewer({
    scrollPageIntoView: ({ pageNumber }: { pageNumber: number }) => {
      emit('internal-link-clicked', pageNumber)
    },
  })
  return service
})

/**
 * Downloads the PDF document.
 * @param filename - Predefined filename to save.
 */
const download = async (filename: string) => {
  if (!doc.value) {
    return
  }

  const data = await doc.value.getData()
  const metadata = await doc.value.getMetadata()
  const suggestedFilename =
    // @ts-expect-error: contentDispositionFilename is not typed
    filename ?? metadata.contentDispositionFilename ?? ''
  downloadPdf(data, suggestedFilename)
}

/**
 * Prints a PDF document via the browser interface.
 * @param dpi - Print resolution.
 * @param filename - Predefined filename to save.
 * @param allPages - Whether to ignore the page prop and print all pages.
 */
const print = async (dpi = 300, filename = '', allPages = false) => {
  if (!doc.value) {
    return
  }

  const printUnits = dpi / 72
  const styleUnits = 96 / 72
  let container: HTMLDivElement
  let iframe: HTMLIFrameElement
  let title: string | undefined

  try {
    container = window.document.createElement('div')
    container.style.display = 'none'
    window.document.body.appendChild(container)
    iframe = await createPrintIframe(container)

    const pageNums =
      props.page && !allPages
        ? [props.page]
        : [...Array(doc.value.numPages + 1).keys()].slice(1)

    await Promise.all(
      pageNums.map(async (pageNum, i) => {
        const page = await doc.value!.getPage(pageNum)
        const viewport = page.getViewport({
          scale: 1,
          rotation: 0,
        })

        if (i === 0) {
          const sizeX = (viewport.width * printUnits) / styleUnits
          const sizeY = (viewport.height * printUnits) / styleUnits
          addPrintStyles(iframe, sizeX, sizeY)
        }

        const canvas = window.document.createElement('canvas')
        canvas.width = viewport.width * printUnits
        canvas.height = viewport.height * printUnits
        container.appendChild(canvas)
        const canvasClone = canvas.cloneNode() as HTMLCanvasElement
        iframe.contentWindow!.document.body.appendChild(canvasClone)

        await page.render({
          canvasContext: canvas.getContext('2d')!,
          intent: 'print',
          transform: [printUnits, 0, 0, printUnits, 0, 0],
          viewport,
        }).promise

        canvasClone.getContext('2d')!.drawImage(canvas, 0, 0)
      })
    )

    if (filename) {
      title = window.document.title
      window.document.title = filename
    }

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  } finally {
    if (title) {
      window.document.title = title
    }

    releaseChildCanvases(container!)
    container!.parentNode?.removeChild(container!)
  }
}

watch(
  doc,
  () => {
    if (doc.value) {
      emit('loaded', doc.value)
    }
  },
  { immediate: true }
)

watch(
  () => [
    doc.value,
    props.annotationLayer,
    props.height,
    props.imageResourcesPath,
    props.page,
    props.rotation,
    props.scale,
    props.textLayer,
    props.width,
  ],
  () => {
    pageNums.value = doc.value
      ? props.page
        ? [props.page]
        : [...Array(doc.value.numPages + 1).keys()].slice(1)
      : []
  },
  { immediate: true }
)

defineExpose({
  doc,
  download,
  print,
})
</script>

<template>
  <div :id="id" class="vue-pdf-embed">
    <template v-if="doc">
      <PageLayers
        v-for="pageNum in pageNums"
        :id="id"
        :key="pageNum"
        :annotation-layer="annotationLayer"
        :doc="doc"
        :height="height"
        :image-resources-path="imageResourcesPath"
        :link-service="linkService"
        :page="pageNum"
        :rotation="rotation"
        :scale="scale"
        :text-layer="textLayer"
        :width="width"
      />
    </template>
  </div>
</template>

<style lang="scss">
.vue-pdf-embed {
  &__page {
    position: relative;

    canvas {
      display: block;
    }
  }
}
</style>
