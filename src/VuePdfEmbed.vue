<script setup lang="ts">
import { computed, onBeforeUnmount, provide, shallowRef, toRef, type Ref } from 'vue'
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
import PdfPage from './PdfPage.vue' // Import the PdfPage component

const props = withDefaults(
  defineProps<{
    /**
     * Whether to enable an annotation layer.
     */
    annotationLayer: boolean
    /**
     * Desired page height.
     */
    height?: number
    /**
     * Root element identifier (inherited by page containers with page number
     * postfixes).
     */
    id: string
    /**
     * Path for annotation icons, including trailing slash.
     */
    imageResourcesPath: string
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
    textLayer: boolean
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

const height = computed(() => props.height ?? 0)
const width = computed(() => props.width ?? 0)

const emit = defineEmits<{
  (e: 'internal-link-clicked', value: number): void
  (e: 'loaded', value: PDFDocumentProxy): void
  (e: 'loading-failed', value: Error): void
  (e: 'password-requested', value: PasswordRequestParams): void
  (e: 'progress', value: OnProgressParameters): void
  (e: 'rendered'): void
  (e: 'rendering-failed', value: Error): void
}>()

const root = shallowRef<HTMLDivElement | null>(null)

const pageNums = computed(() => {
  return props.page
    ? [props.page]
    : doc.value
    ? Array.from({ length: doc.value.numPages }, (_, i) => i + 1)
    : []
})

const { doc } = useVuePdfEmbed({
  onError: (e) => {
    emit('loading-failed', e)
  },
  onPasswordRequest({ callback, isWrongPassword }) {
    emit('password-requested', { callback, isWrongPassword })
  },
  onProgress: (progressParams) => {
    emit('progress', progressParams)
  },
  source: toRef(props, 'source'),
}) as { doc: Ref<PDFDocumentProxy> }

const onPageRendered = () => {
  emit('rendered')
}

const onRenderingFailed = (e: Error) => {
  emit('rendering-failed', e)
}

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

// Provide the linkService to child components
provide('linkService', linkService.value)

const handleInternalLinkClick = (pageNumber: number) => {
  console.log(`Internal link clicked: ${pageNumber}`)
  // Implement page navigation logic
  // For example, scroll to the page or update the current page prop
}

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

/**
 * Renders the PDF document as canvas element(s) and additional layers.
 */
/*  */

/**
 * Renders the page content.
 * @param page - Page proxy.
 * @param viewport - Page viewport.
 * @param canvas - HTML canvas.
 */
/* const renderPage = async (
  page: PDFPageProxy,
  viewport: PageViewport,
  canvas: HTMLCanvasElement
) => {
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({
    canvasContext: canvas.getContext('2d')!,
    viewport,
  }).promise
} */

/* watch(
  doc,
  (newDoc) => {
    if (newDoc) {
      emit('loaded', newDoc)
    }
  },
  { immediate: true }
) */

/* watch(
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
  async ([newDoc]) => {
    if (newDoc) {
      if (renderingController) {
        renderingController.isAborted = true
        await renderingController.promise
      }

      releaseChildCanvases(root.value)
      renderingController = {
        isAborted: false,
        promise: render(),
      }

      await renderingController.promise
      renderingController = null
    }
  },
  { immediate: true }
) */

onBeforeUnmount(() => {
  releaseChildCanvases(root.value)
})

defineExpose({
  doc,
  download,
  print,
})
</script>

<template>
  <div :id="id" ref="root" class="vue-pdf-embed">
    <div v-for="pageNum in pageNums" :key="pageNum">
      <slot name="before-page" :page="pageNum" />

      <!--<div
        :id="id && `${id}-${pageNum}`"
        class="vue-pdf-embed__page"
        :style="{
          '--scale-factor': pageScales[i],
          position: 'relative',
        }"
      >
        <canvas />

        <div v-if="textLayer" class="textLayer" />

        <div v-if="annotationLayer" class="annotationLayer" />
      </div>-->

      <PdfPage
        :id="id && `${id}-${pageNum}`"
        :page-num="pageNum"
        :doc="doc"
        :scale="scale"
        :rotation="rotation"
        :width="width"
        :height="height"
        :annotation-layer="annotationLayer"
        :text-layer="textLayer"
        :image-resources-path="imageResourcesPath"
        @internal-link-clicked="handleInternalLinkClick"
        @rendered="onPageRendered"
        @rendering-failed="onRenderingFailed"
      />

      <slot name="after-page" :page="pageNum" />
    </div>
  </div>
</template>
