<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import { AnnotationLayer, renderTextLayer } from 'pdfjs-dist/legacy/build/pdf'
import { PDFLinkService } from 'pdfjs-dist/web/pdf_viewer'
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
  emptyElement,
  releaseChildCanvases,
} from './utils'
import { useVuePdfEmbed } from './composable'

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
  }
)

const emit = defineEmits<{
  (e: 'internal-link-clicked', value: number): void
  (e: 'loaded', value: PDFDocumentProxy): void
  (e: 'loading-failed', value: Error): void
  (e: 'password-requested', value: PasswordRequestParams): void
  (e: 'progress', value: OnProgressParameters): void
  (e: 'rendered'): void
  (e: 'rendering-failed', value: Error): void
}>()

const pageNums = shallowRef<number[]>([])
const pageRefs = shallowRef<HTMLDivElement[]>([])
const pageScales = ref<number[]>([])
const root = shallowRef<HTMLDivElement | null>(null)

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
    return
  }

  try {
    pageNums.value = props.page
      ? [props.page]
      : [...Array(doc.value.numPages + 1).keys()].slice(1)
    pageScales.value = Array(pageNums.value.length).fill(1)

    await Promise.all(
      pageNums.value.map(async (pageNum, i) => {
        const page = await doc.value!.getPage(pageNum)
        const pageRotation =
          ((props.rotation % 90 === 0 ? props.rotation : 0) + page.rotate) % 360
        const [canvas, div1, div2] = Array.from(pageRefs.value[i].children) as [
          HTMLCanvasElement,
          HTMLDivElement,
          HTMLDivElement,
        ]
        const isTransposed = !!((pageRotation / 90) % 2)
        const [actualWidth, actualHeight] = getPageDimensions(
          isTransposed
            ? page.view[2] / page.view[3]
            : page.view[3] / page.view[2]
        )
        const cssWidth = `${Math.floor(actualWidth)}px`
        const cssHeight = `${Math.floor(actualHeight)}px`
        const pageWidth = isTransposed ? page.view[3] : page.view[2]
        const pageScale = props.scale ?? actualWidth / pageWidth
        const viewport = page.getViewport({
          scale: pageScale,
          rotation: pageRotation,
        })

        pageScales.value[i] = pageScale

        canvas.style.width = cssWidth
        canvas.style.height = cssHeight

        if (div1) {
          div1.style.width = isTransposed ? cssHeight : cssWidth
          div1.style.height = isTransposed ? cssWidth : cssHeight
        }

        if (div2) {
          div2.style.width = isTransposed ? cssHeight : cssWidth
          div2.style.height = isTransposed ? cssWidth : cssHeight
        }

        await renderPage(page, viewport, canvas)

        if (props.textLayer) {
          await renderPageTextLayer(
            page,
            viewport.clone({
              dontFlip: true,
            }),
            div1
          )
        }

        if (props.annotationLayer) {
          await renderPageAnnotationLayer(
            page,
            viewport.clone({
              dontFlip: true,
            }),
            div2 || div1
          )
        }
      })
    )

    emit('rendered')
  } catch (e) {
    pageNums.value = []
    pageScales.value = []
    emit('rendering-failed', e as Error)
  }
}

/**
 * Renders the page content.
 * @param page - Page proxy.
 * @param viewport - Page viewport.
 * @param canvas - HTML canvas.
 */
const renderPage = async (
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
}

/**
 * Renders the annotation layer for the specified page.
 * @param page - Page proxy.
 * @param viewport - Page viewport.
 * @param container - HTML container.
 */
const renderPageAnnotationLayer = async (
  page: PDFPageProxy,
  viewport: PageViewport,
  container: HTMLDivElement
) => {
  emptyElement(container)
  new AnnotationLayer({
    accessibilityManager: null,
    annotationCanvasMap: null,
    div: container,
    l10n: null,
    page,
    viewport,
  }).render({
    annotations: await page.getAnnotations(),
    div: container,
    // @ts-expect-error: no downloading assumed
    downloadManager: null,
    imageResourcesPath: props.imageResourcesPath,
    linkService: linkService.value!,
    page,
    renderForms: false,
    viewport,
  })
}

/**
 * Renders the text layer for the specified page.
 * @param page - Page proxy.
 * @param viewport - Page viewport.
 * @param container - HTML container.
 */
const renderPageTextLayer = async (
  page: PDFPageProxy,
  viewport: PageViewport,
  container: HTMLElement
) => {
  emptyElement(container)
  await renderTextLayer({
    container,
    textContentSource: await page.getTextContent(),
    viewport,
  }).promise
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
  () => props.source,
  () => {
    releaseChildCanvases(root.value!)
  }
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

onBeforeUnmount(() => {
  releaseChildCanvases(root.value!)
})

defineExpose({
  doc,
  download,
  print,
})
</script>

<template>
  <div :id="id" ref="root" class="vue-pdf-embed">
    <div v-for="(pageNum, i) in pageNums" :key="pageNum">
      <slot name="before-page" :page="pageNum" />

      <div
        :id="id && `${id}-${pageNum}`"
        ref="pageRefs"
        class="vue-pdf-embed__page"
        :style="{
          '--scale-factor': pageScales[i],
        }"
      >
        <canvas />

        <div v-if="textLayer" class="textLayer" />

        <div v-if="annotationLayer" class="annotationLayer" />
      </div>

      <slot name="after-page" :page="pageNum" />
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
