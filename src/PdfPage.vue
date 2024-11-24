<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, inject } from 'vue'
import { AnnotationLayer, TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { emptyElement, releaseCanvas } from './utils'
import type { PDFLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs';

interface Props {
  id: string
  pageNum: number
  doc: PDFDocumentProxy | null
  scale: number
  rotation: number
  annotationLayer: boolean
  textLayer: boolean
  imageResourcesPath: string
  width: number
  height: number
}
const props = defineProps<Props>()

const emit = defineEmits([
  'internal-link-clicked',
  'rendered',
  'rendering-failed',
])

const isEnabledLogging = false

const root = ref<HTMLElement | null>(null)
const isVisible = ref(false)
let observer: IntersectionObserver | null = null
let renderingTask: { promise: Promise<void>; cancel: () => void } | null = null
let page: PDFPageProxy | null = null
let cancelRender: (() => void) | null = null

// Inject the linkService from the parent component
const linkService = inject('linkService') as PDFLinkService

// Function to get page dimensions
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

// Function to render the page when it becomes visible
const renderPage = async () => {
  if (!props.doc || !root.value) {
    return
  }

  try {
    page = await props.doc.getPage(props.pageNum)
    if (!page) {
      return
    }
    const pageRotation = ((props.rotation % 90 === 0 ? props.rotation : 0) + page.rotate) % 360
    // Determine if the page is transposed
    const isTransposed = !!((pageRotation / 90) % 2)
    const viewWidth = page.view[2] - page.view[0]
    const viewHeight = page.view[3] - page.view[1]
    // Calculate the actual width and height of the page
    const [actualWidth, actualHeight] = getPageDimensions(
      isTransposed ? viewWidth / viewHeight : viewHeight / viewWidth
    )

    const cssWidth = `${Math.floor(actualWidth)}px`
    const cssHeight = `${Math.floor(actualHeight)}px`
    const pageWidth = isTransposed ? viewHeight : viewWidth
    const pageScale = actualWidth / pageWidth

    // Calculate viewport with appropriate scale and rotation
    const viewport = page.getViewport({
      scale: pageScale,
      rotation: pageRotation,
    })

    const canvas = root.value.querySelector('canvas') as HTMLCanvasElement
    const textLayerDiv = root.value.querySelector('.textLayer') as HTMLDivElement
    const annotationLayerDiv = root.value.querySelector('.annotationLayer') as HTMLDivElement

    if (!canvas) {
      return
    }

    // High-DPI display support
    const outputScale = window.devicePixelRatio || 1
    const adjustedScale = viewport.scale * outputScale * (props.scale || 1)
    const scaledViewport = viewport.clone({ scale: adjustedScale })

    canvas.style.display = 'block'
    canvas.style.width = cssWidth
    canvas.style.height = cssHeight

    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    // Clear the canvas before rendering
    context.clearRect(0, 0, canvas.width, canvas.height)

    // Cancel any previous rendering task
    if (cancelRender) {
      cancelRender()
      cancelRender = null
    }

    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    }

    renderingTask = page.render(renderContext)
    cancelRender = renderingTask.cancel

    const renderTasks = [renderingTask.promise]

    // Render text layer if enabled
    if (props.textLayer && textLayerDiv) {
      const textLayerViewport = viewport.clone({ dontFlip: true })
      const textLayerRenderTask = new TextLayer({
        container: textLayerDiv,
        textContentSource: await page.getTextContent(),
        viewport: textLayerViewport,
      }).render()
      renderTasks.push(textLayerRenderTask)
    }

    // Render annotation layer if enabled
    if (props.annotationLayer && annotationLayerDiv) {
      const annotationLayerViewport = viewport.clone({ dontFlip: true })
      const annotationLayer = new AnnotationLayer({
        accessibilityManager: null,
        annotationCanvasMap: null,
        annotationEditorUIManager: null,
        div: annotationLayerDiv,
        page,
        structTreeLayer: null,
        viewport,
      })
      const annotationRenderTask = annotationLayer.render({
        annotations: await page?.getAnnotations({ intent: 'display' }),
        div: annotationLayerDiv,
        imageResourcesPath: props.imageResourcesPath,
        linkService,
        page,
        renderForms: false,
        viewport: annotationLayerViewport,
      })
      renderTasks.push(annotationRenderTask)
    }

    await Promise.all(renderTasks)

    emit('rendered')
  } catch (error) {
    emit('rendering-failed', error as Error)
  }
}

// Function to clean up resources when the page is not visible
const cleanup = () => {
  if (renderingTask && renderingTask.cancel) {
    if (isEnabledLogging) console.log('Cancelling rendering task 1/2', props.id)
    renderingTask.cancel()
    renderingTask = null
  }

  if (cancelRender) {
    if (isEnabledLogging) console.log('Cancelling render task 2/2', props.id)
    cancelRender()
    cancelRender = null
  }

  // Release canvas
  const canvas = root.value?.querySelector('canvas') as HTMLCanvasElement
  if (canvas) {
    if (isEnabledLogging) console.log('Releasing canvas')
    releaseCanvas(canvas)
  }

  // Empty text and annotation layers
  const textLayerDiv = root.value?.querySelector('.textLayer') as HTMLElement
  if (textLayerDiv) {
    if (isEnabledLogging) console.log('Emptying text layer')
    emptyElement(textLayerDiv)
  }
  const annotationLayerDiv = root.value?.querySelector('.annotationLayer') as HTMLElement
  if (annotationLayerDiv) {
    if (isEnabledLogging) console.log('Emptying annotation layer')
    emptyElement(annotationLayerDiv)
  }

  // Clean up page resources
  if (page) {
    if (isEnabledLogging) console.log('Cleaning up page resources')
    page.cleanup()
    page = null
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      isVisible.value = entry.isIntersecting
      if (isVisible.value) {
        renderPage()
      } else {
        if (isEnabledLogging) console.log('Page is not visible, cleaning up resources')
        cleanup()
      }
    },
    { root: null, threshold: 0.1 }
  )
  if (root.value) {
    observer.observe(root.value)
  }
})

onBeforeUnmount(() => {
  if (observer && root.value) {
    observer.unobserve(root.value)
    observer.disconnect()
  }
  cleanup()
})

// Watch for changes in relevant props
watch(
  () => [props.scale, props.rotation, props.width, props.height],
  () => {
    if (isVisible.value) {
      cleanup()
      renderPage()
    }
  }
)
</script>

<template>
  <div
    :id="id"
    ref="root"
    class="vue-pdf-embed__page"
    :style="{ position: 'relative' }"
  >
    <canvas></canvas>
    <div
      v-if="textLayer"
      class="textLayer"
      :style="{ position: 'absolute', top: 0, left: 0 }"
    ></div>
    <div
      v-if="annotationLayer"
      class="annotationLayer"
      :style="{ position: 'absolute', top: 0, left: 0 }"
    ></div>
  </div>
</template>

<style scoped>
.vue-pdf-embed__page {
  overflow: hidden;
}
</style>
