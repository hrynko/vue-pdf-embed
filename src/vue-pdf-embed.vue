<template>
  <div :id="id" class="vue-pdf-embed">
    <div
      v-for="pageNum in pageNums"
      :key="pageNum"
      :id="id && `${id}-${pageNum}`"
      ref="elementRefs"
    >
      <canvas />

      <div v-if="!disableTextLayer" class="textLayer" />

      <div v-if="!disableAnnotationLayer" class="annotationLayer" />
    </div>
  </div>
</template>

<script setup>
/// <reference types="vue/macros-global" />

const props = defineProps({
  /**
   * Whether the annotation layer should be disabled.
   * @values Boolean
   */
  disableAnnotationLayer: {
    type: Boolean,
    default: true,
  },
  /**
   * Whether the text layer should be disabled.
   * @values Boolean
   */
  disableTextLayer: Boolean,
  /**
   * Desired page height.
   * @values Number, String
   */
  height: [Number, String],
  /**
   * Component identifier (inherited by page containers with page number
   * postfixes).
   * @values String
   */
  id: String,
  /**
   * Path for annotation icons, including trailing slash.
   * @values String
   */
  imageResourcesPath: String,
  /**
   * Number of the page to display.
   * @values Number
   */
  page: Number,
  /**
   * Desired page rotation angle.
   * @values Number, String
   */
  rotation: {
    type: [Number, String],
    validator(value) {
      if (value % 90 !== 0) {
        throw new Error('Rotation must be 0 or a multiple of 90.')
      }
      return true
    },
  },
  /**
   * Desired ratio of canvas size to document size.
   * @values Number
   */
  scale: Number,
  /**
   * Source of the document to display.
   * @values Object, String, URL, TypedArray
   */
  source: {
    type: [Object, String, URL, Uint8Array],
    required: true,
  },
  /**
   * Desired page width.
   * @values Number, String
   */
  width: [Number, String],
})

const $emit = defineEmits([
  'loaded',
  'loading-failed',
  'password-requested',
  'progress',
  'printing-failed',
  'rendered',
  'rendering-failed',
  'internal-link-clicked',
])

let doc = null
let pageCount = $ref(null)
let pageNums = $ref([])

let elementRefs = $ref([])

const _instance = getCurrentInstance()

const instance = $computed(() => {
  return _instance.proxy
})

const linkService = $computed(() => {
  if (!document || props.disableAnnotationLayer) {
    return null
  }

  const service = new PDFLinkService()
  service.setDocument(doc)
  service.setViewer({
    scrollPageIntoView: ({ pageNumber }) => {
      $emit('internal-link-clicked', pageNumber)
    },
  })
  return service
})

/**
 * Returns an array of the actual page width and height based on props and
 * aspect ratio.
 * @param {number} ratio - Page aspect ratio.
 */
function getPageDimensions(ratio) {
  let width, height

  if (props.height && !props.width) {
    height = props.height
    width = height / ratio
  } else {
    width = props.width || instance.$el.clientWidth
    height = width * ratio
  }

  return [width, height]
}

/**
 * Loads a PDF document. Defines a password callback for protected
 * documents.
 *
 * NOTE: Ignored if source property is not provided.
 */
async function load() {
  if (!props.source) {
    console.log('Missing source')
    return
  }

  try {
    if (props.source._pdfInfo) {
      doc = props.source
    } else {
      const documentLoadingTask = pdf.getDocument(props.source)
      documentLoadingTask.onProgress = (progressParams) => {
        $emit('progress', progressParams)
      }
      documentLoadingTask.onPassword = (callback, reason) => {
        const retry = reason === pdf.PasswordResponses.INCORRECT_PASSWORD
        $emit('password-requested', callback, retry)
      }
      doc = await documentLoadingTask.promise
    }
    pageCount = doc.numPages
    $emit('loaded', doc)
  } catch (e) {
    console.error('Failed to load', e)
    doc = null
    pageCount = null
    pageNums = []
    $emit('loading-failed', e)
  }
}

/**
 * Prints a PDF document via the browser interface.
 *
 * NOTE: Ignored if the document is not loaded.
 *
 * @param {number} dpi - Print resolution.
 * @param {string} filename - Predefined filename to save.
 * @param {boolean} allPages - Ignore page prop to print all pages.
 */
async function print(dpi = 300, filename = '', allPages = false) {
  if (!doc) {
    return
  }

  const printUnits = dpi / 72
  const styleUnits = 96 / 72
  let container, iframe, title

  try {
    container = document.createElement('div')
    container.style.display = 'none'
    window.document.body.appendChild(container)
    iframe = await createPrintIframe(container)

    const pageNums =
      props.page && !allPages
        ? [props.page]
        : [...Array(doc.numPages + 1).keys()].slice(1)

    await Promise.all(
      pageNums.map(async (pageNum, i) => {
        const page = await doc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1 })

        if (i === 0) {
          const sizeX = (viewport.width * printUnits) / styleUnits
          const sizeY = (viewport.height * printUnits) / styleUnits
          addPrintStyles(iframe, sizeX, sizeY)
        }

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width * printUnits
        canvas.height = viewport.height * printUnits
        container.appendChild(canvas)
        const canvasClone = canvas.cloneNode()
        iframe.contentWindow.document.body.appendChild(canvasClone)

        await page.render({
          canvasContext: canvas.getContext('2d'),
          intent: 'print',
          transform: [printUnits, 0, 0, printUnits, 0, 0],
          viewport,
        }).promise

        canvasClone.getContext('2d').drawImage(canvas, 0, 0)
      })
    )

    if (filename) {
      title = window.document.title
      window.document.title = filename
    }

    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  } catch (e) {
    $emit('printing-failed', e)
  } finally {
    if (title) {
      window.document.title = title
    }

    releaseChildCanvases(container)
    container.parentNode?.removeChild(container)
  }
}

function setPageNums() {
  if (!doc) {
    return
  }

  pageNums = props.page
    ? [props.page]
    : [...Array(doc.numPages + 1).keys()].slice(1)
}

/**
 * Renders the PDF document as SVG element(s) and additional layers.
 *
 * NOTE: Ignored if the document is not loaded.
 */
async function render() {
  if (!doc || elementRefs.length !== pageNums.length) {
    return
  }

  try {
    await Promise.all(
      pageNums.map(async (pageNum, i) => {
        const page = await doc.getPage(pageNum)
        const [canvas, div1, div2] = elementRefs[i].children
        const [actualWidth, actualHeight] = getPageDimensions(
          page.view[3] / page.view[2]
        )

        if ((props.rotation / 90) % 2) {
          canvas.style.width = `${Math.floor(actualHeight)}px`
          canvas.style.height = `${Math.floor(actualWidth)}px`
        } else {
          canvas.style.width = `${Math.floor(actualWidth)}px`
          canvas.style.height = `${Math.floor(actualHeight)}px`
        }

        renderPage(page, canvas, actualWidth)

        if (!props.disableTextLayer) {
          await renderPageTextLayer(page, div1, actualWidth)
        }

        if (!props.disableAnnotationLayer) {
          await renderPageAnnotationLayer(page, div2 || div1, actualWidth)
        }
      })
    )

    $emit('rendered')
  } catch (e) {
    console.error('Failed to render', e)
    doc = null
    pageCount = null
    pageNums = []
    $emit('rendering-failed', e)
  }
}

/**
 * Renders the page content.
 * @param {PDFPageProxy} page - Page proxy.
 * @param {HTMLCanvasElement} canvas - HTML canvas.
 * @param {number} width - Actual page width.
 */
async function renderPage(page, canvas, width) {
  const viewport = page.getViewport({
    scale: props.scale ?? Math.ceil(width / page.view[2]) + 1,
    rotation: props.rotation,
  })

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport,
  }).promise
}

/**
 * Renders the annotation layer for the specified page.
 * @param {PDFPageProxy} page - Page proxy.
 * @param {HTMLElement} container - HTML container.
 * @param {number} width - Actual page width.
 */
async function renderPageAnnotationLayer(page, container, width) {
  emptyElement(container)
  pdf.AnnotationLayer.render({
    annotations: await page.getAnnotations(),
    div: container,
    linkService: linkService,
    page,
    renderInteractiveForms: false,
    viewport: page
      .getViewport({
        scale: width / page.view[2],
        rotation: props.rotation,
      })
      .clone({
        dontFlip: true,
      }),
    imageResourcesPath: props.imageResourcesPath,
  })
}

/**
 * Renders the text layer for the specified page.
 * @param {PDFPageProxy} page - Page proxy.
 * @param {HTMLElement} container - HTML container.
 * @param {number} width - Actual page width.
 */
async function renderPageTextLayer(page, container, width) {
  emptyElement(container)
  await pdf.renderTextLayer({
    container,
    textContent: await page.getTextContent(),
    viewport: page.getViewport({
      scale: width / page.view[2],
      rotation: props.rotation,
    }),
  }).promise
}

onBeforeUnmount(() => {
  releaseChildCanvases(instance.$el)
  doc?.destroy()
})

onMounted(async () => {
  await load()
  setPageNums()
  nextTick(() => render())
})

watch(
  [
    () => props.source,
    () => props.disableAnnotationLayer,
    () => props.disableTextLayer,
    () => props.height,
    () => props.page,
    () => props.rotation,
    () => props.width,
    () => elementRefs,
  ],
  async ([newSource], [oldSource]) => {
    if (newSource !== oldSource) {
      releaseChildCanvases(instance.$el)
      await load()
    }
    setPageNums()
    nextTick(() => {
      render()
    })
  }
)

defineExpose({
  render,
  print,
  pageCount: readonly($$(pageCount)),
  pageNums: readonly($$(pageNums)),
})
</script>

<script>
import {
  defineProps,
  getCurrentInstance,
  defineEmits,
  onBeforeUnmount,
  onMounted,
  watch,
  defineExpose,
  readonly,
  nextTick,
} from 'vue'
import * as pdf from 'pdfjs-dist/legacy/build/pdf.js'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.js?worker&inline'
import { PDFLinkService } from 'pdfjs-dist/legacy/web/pdf_viewer.js'
import {
  addPrintStyles,
  createPrintIframe,
  emptyElement,
  releaseChildCanvases,
} from './util.js'

pdf.GlobalWorkerOptions.workerPort = new PdfWorker()
</script>

<style lang="scss">
@import 'styles/text-layer';
@import 'styles/annotation-layer';

.vue-pdf-embed {
  & > div {
    position: relative;
  }

  canvas {
    display: block;
  }
}
</style>
