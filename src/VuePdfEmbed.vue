<script setup lang="ts">
import { computed, shallowRef, toRef, watch } from 'vue'
import { PDFLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs'
import type {
  OnProgressParameters,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
} from 'pdfjs-dist'

import type { PasswordRequestParams, Source } from './types'
import {
  addPrintStyles,
  createPrintIframe,
  downloadPdf,
  releaseChildCanvases,
} from './utils'
import { useVuePdfEmbed } from './composables'
import AnnotationLayer from './AnnotationLayer.vue'
import BaseLayer from './BaseLayer.vue'
import TextLayer from './TextLayer.vue'

const { devicePixelRatio } = window

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

const pageProxies = shallowRef<PDFPageProxy[]>([])
const pageScales = shallowRef<number[]>([])
const pageStyles = shallowRef<Record<string, string>[]>([])
const pageViewports = shallowRef<PageViewport[]>([])
const root = shallowRef<HTMLDivElement | null>(null)

const { doc } = useVuePdfEmbed({
  onError: (e) => {
    reset()
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
const render = async () => {
  if (!doc.value) {
    reset()
    return
  }

  try {
    const pageNums = props.page
      ? [props.page]
      : [...Array(doc.value.numPages + 1).keys()].slice(1)

    pageProxies.value = []
    pageScales.value = []
    pageStyles.value = []
    pageViewports.value = []

    pageNums.forEach(async (pageNum) => {
      const page = await doc.value!.getPage(pageNum)
      const pageRotation =
        ((props.rotation % 90 === 0 ? props.rotation : 0) + page.rotate) % 360
      const isTransposed = !!((pageRotation / 90) % 2)
      const [actualWidth, actualHeight] = getPageDimensions(
        isTransposed ? page.view[2] / page.view[3] : page.view[3] / page.view[2]
      )
      const pageWidth = isTransposed ? page.view[3] : page.view[2]
      const pageScale = actualWidth / pageWidth

      pageProxies.value = [...pageProxies.value, page]
      pageScales.value.push(pageScale)
      pageStyles.value.push({
        width: `${Math.floor(actualWidth)}px`,
        height: `${Math.floor(actualHeight)}px`,
      })
      pageViewports.value.push(
        page.getViewport({
          scale: pageScale,
          rotation: pageRotation,
        })
      )
    })
  } catch {
    reset()
  }
}

const reset = async () => {
  pageProxies.value = []
  pageScales.value = []
  pageStyles.value = []
  pageViewports.value = []
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
    if (doc.value) {
      render()
    }
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
  <div :id="id" ref="root" class="vue-pdf-embed">
    <div v-for="(pageProxy, i) in pageProxies" :key="pageProxy.pageNumber">
      <slot name="before-page" :page="pageProxy.pageNumber" />

      <div
        :id="id && `${id}-${pageProxy.pageNumber}`"
        class="vue-pdf-embed__page"
        :style="{
          '--scale-factor': pageScales[i],
        }"
      >
        <BaseLayer
          :page="pageProxy"
          :viewport="
            pageViewports[i].clone({
              scale: pageViewports[i].scale * devicePixelRatio * scale,
            })
          "
          :style="pageStyles[i]"
        />

        <TextLayer
          v-if="textLayer"
          :page="pageProxy"
          :viewport="pageViewports[i].clone({ dontFlip: true })"
        />

        <AnnotationLayer
          v-if="annotationLayer"
          :page="pageProxy"
          :viewport="pageViewports[i].clone({ dontFlip: true })"
          :link-service="linkService"
        />
      </div>

      <slot name="after-page" :page="pageProxy.pageNumber" />
    </div>
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
