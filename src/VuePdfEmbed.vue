<template>
  <div :id="id" ref="root" class="vue-pdf-embed">
    <div v-for="pageNum in pageNums" :key="pageNum">
      <slot name="before-page" :page="pageNum" />

      <div :id="id && `${id}-${pageNum}`" class="vue-pdf-embed__page">
        <canvas />

        <div v-if="textLayer" class="textLayer" />

        <div v-if="annotationLayer" class="annotationLayer" />
      </div>

      <slot name="after-page" :page="pageNum" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type {
  GetDocumentParameters,
  OnProgressParameters,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist/types/src/display/api'
import * as pdf from 'pdfjs-dist/legacy/build/pdf'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min?url'
import { PDFLinkService } from 'pdfjs-dist/legacy/web/pdf_viewer'
import {
  addPrintStyles,
  createPrintIframe,
  downloadPdf,
  emptyElement,
  releaseChildCanvases,
} from './util'

pdf.GlobalWorkerOptions.workerSrc = PdfWorker

const props = withDefaults(
  defineProps<{
    /**
     * Whether the annotation layer should be enabled.
     */
    annotationLayer?: boolean
    /**
     * Desired page height.
     */
    height?: number | string
    /**
     * Component identifier (inherited by page containers with page number
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
    rotation?: number | string
    /**
     * Desired ratio of canvas size to document size.
     */
    scale?: number
    /**
     * Source of the document to display.
     */
    source: GetDocumentParameters | PDFDocumentProxy
    /**
     * Whether the text layer should be enabled.
     */
    textLayer?: boolean
    /**
     * Desired page width.
     */
    width?: number | string
  }>(),
  {
    rotation: 0,
  }
)

const emit = defineEmits<{
  (e: 'internal-link-clicked', value: number): void
  (e: 'loaded', value: PDFDocumentProxy): void
  (e: 'loading-failed', value: Error): void
  (e: 'password-requested', value: { callback: Function; retry: boolean }): void
  (e: 'progress', value: OnProgressParameters): void
  (e: 'rendered'): void
  (e: 'rendering-failed', value: Error): void
}>()

const document = ref<PDFDocumentProxy | null>(null)
const documentLoadingTask = ref<PDFDocumentLoadingTask | null>(null)
const pageCount = ref<number | null>(null)
const pageNums = ref<number[]>([])
const root = ref<HTMLDivElement | null>(null)

const linkService = computed(() => {
  if (!document.value || !props.annotationLayer) {
    return null
  }

  const service = new PDFLinkService()
  service.setDocument(document.value)
  service.setViewer({
    scrollPageIntoView: ({ pageNumber }: { pageNumber: number }) => {
      emit('internal-link-clicked', pageNumber)
    },
  })
  return service
})

/**
 * Downloads a PDF document.
 * @param filename - Predefined filename to save.
 */
const download = async (filename: string) => {
  if (!document.value) {
    return
  }

  const documentRaw = toRaw(document.value)
  const data = await documentRaw.getData()
  const metadata = await documentRaw.getMetadata()
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
    height = +props.height
    width = height / ratio
  } else {
    width = +(props.width || root.value!.clientWidth)
    height = width * ratio
  }

  return [width, height]
}

/**
 * Loads a PDF document. Defines a password callback for protected
 * documents.
 */
const load = async () => {
  if (!props.source) {
    return
  }

  try {
    if (Object.prototype.hasOwnProperty.call(props.source, '_pdfInfo')) {
      document.value = props.source as PDFDocumentProxy
    } else {
      documentLoadingTask.value = pdf.getDocument(
        props.source as GetDocumentParameters
      )
      documentLoadingTask.value.onProgress = (
        progressParams: OnProgressParameters
      ) => {
        emit('progress', progressParams)
      }
      documentLoadingTask.value.onPassword = (
        callback: Function,
        reason: number
      ) => {
        const retry = reason === pdf.PasswordResponses.INCORRECT_PASSWORD
        emit('password-requested', { callback, retry })
      }
      document.value = await documentLoadingTask.value.promise
    }
    pageCount.value = document.value!.numPages
    emit('loaded', toRaw(document.value) as PDFDocumentProxy)
  } catch (e) {
    document.value = null
    pageCount.value = null
    pageNums.value = []
    emit('loading-failed', e as Error)
  }
}

/**
 * Prints a PDF document via the browser interface.
 * @param dpi - Print resolution.
 * @param filename - Predefined filename to save.
 * @param allPages - Ignore page prop to print all pages.
 */
const print = async (dpi = 300, filename = '', allPages = false) => {
  if (!document.value) {
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
        : [...Array(document.value.numPages + 1).keys()].slice(1)

    await Promise.all(
      pageNums.map(async (pageNum, i) => {
        const page = await toRaw(document.value)!.getPage(pageNum)
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
  if (!document.value) {
    return
  }

  try {
    pageNums.value = props.page
      ? [props.page]
      : [...Array(document.value.numPages + 1).keys()].slice(1)

    const pageElements = root.value!.getElementsByClassName(
      'vue-pdf-embed__page'
    )

    await Promise.all(
      pageNums.value.map(async (pageNum, i) => {
        const page = await toRaw(document.value)!.getPage(pageNum)
        const pageRotation =
          (+props.rotation % 90 === 0 ? +props.rotation : 0) + page.rotate
        const [canvas, div1, div2] = Array.from(pageElements[i].children) as [
          HTMLCanvasElement,
          HTMLDivElement,
          HTMLDivElement,
        ]
        const [actualWidth, actualHeight] = getPageDimensions(
          (pageRotation / 90) % 2
            ? page.view[2] / page.view[3]
            : page.view[3] / page.view[2]
        )

        canvas.style.width = `${Math.floor(actualWidth)}px`
        canvas.style.height = `${Math.floor(actualHeight)}px`

        await renderPage(page, canvas, actualWidth, pageRotation)

        if (props.textLayer) {
          await renderPageTextLayer(page, div1, actualWidth, pageRotation)
        }

        if (props.annotationLayer) {
          await renderPageAnnotationLayer(
            page,
            div2 || div1,
            actualWidth,
            pageRotation
          )
        }
      })
    )

    emit('rendered')
  } catch (e) {
    document.value = null
    pageCount.value = null
    pageNums.value = []
    emit('rendering-failed', e as Error)
  }
}

/**
 * Renders the page content.
 * @param page - Page proxy.
 * @param canvas - HTML canvas.
 * @param width - Actual page width.
 * @param rotation - Total page rotation.
 */
const renderPage = async (
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  width: number,
  rotation: number
) => {
  const pageWidth = (rotation / 90) % 2 ? page.view[3] : page.view[2]
  const viewport = page.getViewport({
    scale: props.scale ?? Math.ceil(width / pageWidth) + 1,
    rotation,
  })

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
 * @param container - HTML container.
 * @param width - Actual page width.
 * @param rotation - Total page rotation.
 */
const renderPageAnnotationLayer = async (
  page: PDFPageProxy,
  container: HTMLDivElement,
  width: number,
  rotation: number
) => {
  emptyElement(container)
  const pageWidth = (rotation / 90) % 2 ? page.view[3] : page.view[2]
  pdf.AnnotationLayer.render({
    annotations: await page.getAnnotations(),
    div: container,
    downloadManager: null,
    imageResourcesPath: props.imageResourcesPath,
    linkService: linkService.value!,
    page,
    renderForms: false,
    viewport: page
      .getViewport({
        scale: width / pageWidth,
        rotation,
      })
      .clone({
        dontFlip: true,
      }),
  })
}

/**
 * Renders the text layer for the specified page.
 * @param page - Page proxy.
 * @param container - HTML container.
 * @param width - Actual page width.
 * @param rotation - Total page rotation.
 */
const renderPageTextLayer = async (
  page: PDFPageProxy,
  container: HTMLElement,
  width: number,
  rotation: number
) => {
  emptyElement(container)
  const pageWidth = (rotation / 90) % 2 ? page.view[3] : page.view[2]
  await pdf.renderTextLayer({
    container,
    textContent: await page.getTextContent(),
    viewport: page.getViewport({
      scale: width / pageWidth,
      rotation,
    }),
  }).promise
}

watch(
  () => [
    props.source,
    props.annotationLayer,
    props.height,
    props.page,
    props.rotation,
    props.textLayer,
    props.width,
  ],
  async ([newSource], [oldSource]) => {
    if (newSource !== oldSource) {
      releaseChildCanvases(root.value!)
      await load()
    }
    render()
  }
)

onMounted(async () => {
  await load()
  render()
})

onBeforeUnmount(async () => {
  releaseChildCanvases(root.value!)
  if (documentLoadingTask.value?.onPassword) {
    // @ts-expect-error: onPassword must be reset
    documentLoadingTask.value.onPassword = null
  }
  if (documentLoadingTask.value?.onProgress) {
    // @ts-expect-error: onProgress must be reset
    documentLoadingTask.value.onProgress = null
  }
  toRaw(document.value)?.destroy()
})

defineExpose({
  document,
  download,
  pageCount,
  pageNums,
  print,
})
</script>

<style lang="scss">
@import 'styles/text-layer';
@import 'styles/annotation-layer';

.vue-pdf-embed {
  &__page {
    position: relative;

    canvas {
      display: block;
    }
  }
}
</style>
