<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import { AnnotationLayer, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFLinkService } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
import type {
  OnProgressParameters,
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
} from 'pdfjs-dist'

import type { PasswordRequestParams, Source } from './types'
import { emptyElement, releaseChildCanvases } from './utils'
import { useVuePdfEmbed } from './composables'

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
     * Page number(s) to display.
     */
    page?: number | number[]
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
  (e: 'rendered'): void
  (e: 'rendering-failed', value: Error): void
}>()

const pageNums = shallowRef<number[]>([])
const pageScales = ref<number[]>([])
const root = shallowRef<HTMLDivElement | null>(null)

let renderingController: { isAborted: boolean; promise: Promise<void> } | null =
  null

const { doc, download, print } = useVuePdfEmbed({
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
 */
const render = async () => {
  if (!doc.value || renderingController?.isAborted) {
    return
  }

  try {
    pageNums.value = props.page
      ? Array.isArray(props.page)
        ? props.page
        : [props.page]
      : [...Array(doc.value.numPages + 1).keys()].slice(1)
    pageScales.value = Array(pageNums.value.length).fill(1)

    await Promise.all(
      pageNums.value.map(async (pageNum, i) => {
        const page = await doc.value!.getPage(pageNum)
        if (renderingController?.isAborted) {
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
        const cssWidth = `${Math.floor(actualWidth)}px`
        const cssHeight = `${Math.floor(actualHeight)}px`
        const pageWidth = isTransposed ? viewHeight : viewWidth
        const pageScale = actualWidth / pageWidth
        const viewport = page.getViewport({
          scale: pageScale,
          rotation: pageRotation,
        })

        pageScales.value[i] = pageScale

        canvas.style.display = 'block'
        canvas.style.width = cssWidth
        canvas.style.height = cssHeight

        const renderTasks = [
          renderPage(
            page,
            viewport.clone({
              scale: viewport.scale * window.devicePixelRatio * props.scale,
            }),
            canvas
          ),
        ]

        if (props.textLayer) {
          renderTasks.push(
            renderPageTextLayer(
              page,
              viewport.clone({
                dontFlip: true,
              }),
              div1
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
              div2 || div1
            )
          )
        }

        return Promise.all(renderTasks)
      })
    )

    if (!renderingController?.isAborted) {
      emit('rendered')
    }
  } catch (e) {
    pageNums.value = []
    pageScales.value = []

    if (!renderingController?.isAborted) {
      emit('rendering-failed', e as Error)
    }
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
  await new AnnotationLayer({
    accessibilityManager: null,
    annotationCanvasMap: null,
    annotationEditorUIManager: null,
    div: container,
    page,
    structTreeLayer: null,
    viewport,
  }).render({
    annotations: await page.getAnnotations(),
    div: container,
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
  await new TextLayer({
    container,
    textContentSource: await page.getTextContent(),
    viewport,
  }).render()

  const endOfContent = document.createElement('div')
  endOfContent.className = 'endOfContent'
  container.append(endOfContent)
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
)

onBeforeUnmount(() => {
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
          '--scale-factor': pageScales[i],
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
