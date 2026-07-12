<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import { AnnotationLayer, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  EventBus,
  PDFLinkService,
  type PDFFindController,
} from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
import type {
  OnProgressParameters,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
} from 'pdfjs-dist'

import type { PasswordRequestParams, Source } from './types'
import {
  emptyElement,
  isCancellationError,
  releaseChildCanvases,
} from './internal/utils'
import { TextHighlighter } from './internal/highlighter'
import { usePdfDocument } from './composables'

const props = withDefaults(
  defineProps<{
    /**
     * Whether to enable an annotation layer.
     */
    annotationLayer?: boolean
    /**
     * Find controller for highlighting text matches. Requires the text layer
     * to be enabled.
     */
    findController?: PDFFindController
    /**
     * Whether to render interactive form fields (AcroForm). Requires the
     * annotation layer to be enabled.
     */
    forms?: boolean
    /**
     * Desired page height.
     */
    height?: number
    /**
     * Root element identifier (inherited by page containers with page number
     * suffixes).
     */
    id?: string
    /**
     * Path for annotation icons, including trailing slash.
     */
    imageResourcesPath?: string
    /**
     * Document navigation service.
     */
    linkService?: PDFLinkService
    /**
     * Whether to scroll the selected search match into view. Defaults to
     * `true`.
     */
    matchScrolling?: boolean
    /**
     * Page number(s) to display.
     */
    page?: number | number[]
    /**
     * Desired page rotation angle.
     */
    rotation?: number
    /**
     * Multiplier for the canvas rendering resolution, controlling the
     * sharpness of the rendered page.
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
    matchScrolling: true,
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
  (e: 'rendered'): void
  (e: 'rendering-failed', value: Error): void
}>()

const pageNums = shallowRef<number[]>([])
const pageScales = ref<number[]>([])
const root = shallowRef<HTMLDivElement | null>(null)
let highlighters: TextHighlighter[] = []

const { doc, download, print } = usePdfDocument({
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
  } else if (props.linkService) {
    return props.linkService
  }

  const service = new PDFLinkService({ eventBus: new EventBus() })
  service.setDocument(doc.value)
  service.setViewer({
    scrollPageIntoView: ({ pageNumber }: { pageNumber: number }) => {
      emit('internal-link-clicked', pageNumber)
    },
  })
  return service
})

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
 * Renders the PDF document as canvas element(s) and additional layers.
 * @param signal - Abort signal.
 */
const render = async (signal: AbortSignal) => {
  if (!doc.value || signal.aborted) {
    return
  }

  try {
    highlighters.forEach((highlighter) => highlighter.disable())
    highlighters = []

    pageNums.value = props.page
      ? Array.isArray(props.page)
        ? props.page
        : [props.page]
      : [...Array(doc.value.numPages + 1).keys()].slice(1)
    pageScales.value = Array(pageNums.value.length).fill(1)

    await Promise.all(
      pageNums.value.map(async (pageNum, i) => {
        const page = await doc.value!.getPage(pageNum)
        if (signal.aborted) {
          return
        }
        const pageRotation =
          ((props.rotation % 90 === 0 ? props.rotation : 0) + page.rotate) % 360
        const [canvas, div1, div2] = Array.from(
          root.value!.getElementsByClassName('vue-pdf-embed__page')[i].children
        ) as [HTMLCanvasElement, HTMLDivElement, HTMLDivElement]
        const isTransposed = !!((pageRotation / 90) % 2)
        const viewWidth = page.view[2] - page.view[0]
        const viewHeight = page.view[3] - page.view[1]
        const [actualWidth, actualHeight] = getPageDimensions(
          isTransposed ? viewWidth / viewHeight : viewHeight / viewWidth
        )
        const pageWidth = isTransposed ? viewHeight : viewWidth
        const pageScale = actualWidth / pageWidth
        const viewport = page.getViewport({
          scale: pageScale,
          rotation: pageRotation,
        })

        pageScales.value[i] = pageScale
        canvas.style.display = 'block'
        canvas.style.width = `${Math.floor(actualWidth)}px`
        canvas.style.height = `${Math.floor(actualHeight)}px`

        const renderTasks = [
          renderPage(
            page,
            viewport.clone({
              scale: viewport.scale * window.devicePixelRatio * props.scale,
            }),
            canvas,
            signal
          ),
        ]

        if (props.textLayer) {
          renderTasks.push(
            renderPageTextLayer(
              page,
              viewport.clone({
                dontFlip: true,
              }),
              div1,
              signal
            )
          )
        }

        if (props.annotationLayer) {
          renderTasks.push(
            renderPageAnnotationLayer(
              page,
              viewport.clone({
                dontFlip: true,
              }),
              div2 || div1,
              signal
            )
          )
        }

        return Promise.all(renderTasks)
      })
    )

    if (!signal.aborted) {
      emit('rendered')
    }
  } catch (e) {
    if (signal.aborted || isCancellationError(e)) {
      return
    }

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
 * @param signal - Abort signal.
 */
const renderPage = async (
  page: PDFPageProxy,
  viewport: PageViewport,
  canvas: HTMLCanvasElement,
  signal: AbortSignal
) => {
  canvas.width = viewport.width
  canvas.height = viewport.height
  const task = page.render({ canvas, viewport })
  const abort = () => task.cancel?.()
  signal.addEventListener('abort', abort, { once: true })

  try {
    await task.promise
  } catch (e) {
    if (!isCancellationError(e)) {
      throw e
    }
  } finally {
    signal.removeEventListener('abort', abort)
  }
}

/**
 * Renders the annotation layer for the specified page.
 * @param page - Page proxy.
 * @param viewport - Page viewport.
 * @param container - HTML container.
 * @param signal - Abort signal.
 */
const renderPageAnnotationLayer = async (
  page: PDFPageProxy,
  viewport: PageViewport,
  container: HTMLDivElement,
  signal: AbortSignal
) => {
  const annotations = await page.getAnnotations()
  if (signal.aborted) {
    return
  }

  emptyElement(container)

  await new AnnotationLayer({
    accessibilityManager: null,
    annotationCanvasMap: null,
    annotationEditorUIManager: null,
    annotationStorage: doc.value!.annotationStorage,
    commentManager: null,
    div: container,
    linkService: linkService.value!,
    page,
    structTreeLayer: null,
    viewport,
  }).render({
    annotations,
    div: container,
    imageResourcesPath: props.imageResourcesPath,
    linkService: linkService.value!,
    page,
    renderForms: !!props.forms,
    viewport,
  })
}

/**
 * Renders the text layer for the specified page.
 * @param page - Page proxy.
 * @param viewport - Page viewport.
 * @param container - HTML container.
 * @param signal - Abort signal.
 */
const renderPageTextLayer = async (
  page: PDFPageProxy,
  viewport: PageViewport,
  container: HTMLElement,
  signal: AbortSignal
) => {
  const textContentSource = await page.getTextContent()
  if (signal.aborted) {
    return
  }

  emptyElement(container)
  const textLayer = new TextLayer({
    container,
    textContentSource,
    viewport,
  })
  const abort = () => textLayer.cancel?.()
  signal.addEventListener('abort', abort, { once: true })

  try {
    await textLayer.render()
  } catch (e) {
    if (!isCancellationError(e)) {
      throw e
    }
    return
  } finally {
    signal.removeEventListener('abort', abort)
  }

  if (signal.aborted) {
    return
  }

  const endOfContent = document.createElement('div')
  endOfContent.className = 'endOfContent'
  container.append(endOfContent)

  if (props.findController) {
    const highlighter = new TextHighlighter({
      findController: props.findController,
      matchScrolling: props.matchScrolling,
      pageIndex: page.pageNumber - 1,
    })
    highlighter.setTextMapping(
      textLayer.textDivs,
      textLayer.textContentItemsStr
    )
    highlighter.enable()
    highlighters.push(highlighter)
  }
}

watch(
  doc,
  (newDoc) => {
    if (newDoc) {
      emit('loaded', newDoc)
    }
  },
  { immediate: true }
)

watch(
  () => [
    doc.value,
    props.annotationLayer,
    props.findController,
    props.forms,
    props.height,
    props.imageResourcesPath,
    props.matchScrolling,
    props.page,
    props.rotation,
    props.scale,
    props.textLayer,
    props.width,
  ],
  ([newDoc], _, onCleanup) => {
    if (newDoc) {
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      render(controller.signal)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  highlighters.forEach((highlighter) => highlighter.disable())
  releaseChildCanvases(root.value)
})

defineExpose({
  doc,
  download,
  print: (dpi?: number, filename?: string, allPages = false) =>
    print(dpi, filename, allPages ? undefined : props.page),
})
</script>

<template>
  <div :id="id" ref="root" class="vue-pdf-embed">
    <div v-for="(pageNum, i) in pageNums" :key="pageNum">
      <slot name="before-page" :page="pageNum" />

      <div
        :id="id && `${id}-${pageNum}`"
        class="vue-pdf-embed__page"
        :style="{
          '--scale-round-x': '1px',
          '--scale-round-y': '1px',
          '--total-scale-factor': pageScales[i],
          position: 'relative',
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
