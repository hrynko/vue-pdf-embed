<template>
  <div :id="id" class="vue-pdf-embed">
    <div
      v-for="pageNum in pageNums"
      :key="pageNum"
      :id="id && `${id}-${pageNum}`"
    >
      <canvas />

      <div v-if="!disableTextLayer" class="textLayer" />

      <div v-if="!disableAnnotationLayer" class="annotationLayer" />
    </div>
  </div>
</template>

<script>
import * as pdf from 'pdfjs-dist/legacy/build/pdf.js'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.js'
import { PDFLinkService } from 'pdfjs-dist/legacy/web/pdf_viewer.js'

pdf.GlobalWorkerOptions.workerPort = new PdfWorker()

export default {
  name: 'VuePdfEmbed',
  props: {
    /**
     * Whether the annotation layer should be disabled.
     * @values Boolean
     */
    disableAnnotationLayer: Boolean,
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
     * Number of the page to display.
     * @values Number
     */
    page: Number,
    /**
     * Source of the document to display.
     * @values String, URL, TypedArray
     */
    source: {
      type: [Object, String, Uint8Array],
      required: true,
    },
    /**
     * Desired page width.
     * @values Number, String
     */
    width: [Number, String],
  },
  data() {
    return {
      document: null,
      pageCount: null,
      pageNums: [],
    }
  },
  computed: {
    linkService() {
      if (!this.document || this.disableAnnotationLayer) {
        return null
      }

      const service = new PDFLinkService()
      service.setDocument(this.document)
      service.setViewer({
        scrollPageIntoView: ({ pageNumber }) => {
          this.$emit('internal-link-clicked', pageNumber)
        },
      })
      return service
    },
  },
  watch: {
    disableAnnotationLayer() {
      this.render()
    },
    disableTextLayer() {
      this.render()
    },
    height() {
      this.render()
    },
    page() {
      this.render()
    },
    source: {
      immediate: true,
      async handler() {
        await this.load()
        this.render()
      },
    },
    width() {
      this.render()
    },
  },
  methods: {
    /**
     * Returns an array of the actual page width and height based on props and
     * aspect ratio.
     * @param {number} ratio - Page aspect ratio.
     */
    getPageDimensions(ratio) {
      let width, height

      if (this.height && !this.width) {
        height = this.height
        width = height / ratio
      } else {
        width = this.width || this.$el.clientWidth
        height = width * ratio
      }

      return [width, height]
    },
    /**
     * Loads a PDF document. Defines a password callback for protected
     * documents.
     *
     * NOTE: Ignored if source property is not provided.
     */
    async load() {
      if (!this.source) {
        return
      }

      try {
        const documentLoadingTask = pdf.getDocument(this.source)
        documentLoadingTask.onPassword = (callback, reason) => {
          const retry = reason === pdf.PasswordResponses.INCORRECT_PASSWORD
          this.$emit('password-requested', callback, retry)
        }
        this.document = await documentLoadingTask.promise
        this.pageCount = this.document.numPages
      } catch (e) {
        this.document = null
        this.pageCount = null
        this.pageNums = []
        this.$emit('loading-failed', e)
      }
    },
    /**
     * Renders the PDF document as SVG element(s) and additional layers.
     *
     * NOTE: Ignored if the document is not loaded.
     */
    async render() {
      if (!this.document) {
        return
      }

      try {
        this.pageNums = this.page
          ? [this.page]
          : [...Array(this.document.numPages + 1).keys()].slice(1)

        await Promise.all(
          this.pageNums.map(async (pageNum, i) => {
            const page = await this.document.getPage(pageNum)
            const [canvas, div1, div2] = this.$el.children[i].children
            const [actualWidth, actualHeight] = this.getPageDimensions(
              page.view[3] / page.view[2]
            )

            canvas.style.width = `${Math.floor(actualWidth)}px`
            canvas.style.height = `${Math.floor(actualHeight)}px`

            await this.renderPage(page, canvas, actualWidth)

            if (!this.disableTextLayer) {
              await this.renderPageTextLayer(page, div1, actualWidth)
            }

            if (!this.disableAnnotationLayer) {
              await this.renderPageAnnotationLayer(
                page,
                div2 || div1,
                actualWidth
              )
            }
          })
        )

        this.$emit('rendered')
      } catch (e) {
        this.document = null
        this.pageCount = null
        this.pageNums = []
        this.$emit('rendering-failed', e)
      }
    },
    /**
     * Renders the page content.
     * @param {PDFPageProxy} page - Page proxy.
     * @param {HTMLCanvasElement} canvas - HTML canvas.
     * @param {number} width - Actual page width.
     */
    async renderPage(page, canvas, width) {
      const viewport = page.getViewport({
        scale: Math.ceil(width / page.view[2]) + 1,
      })

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      }).promise
    },
    /**
     * Renders the annotation layer for the specified page.
     * @param {PDFPageProxy} page - Page proxy.
     * @param {HTMLElement} container - HTML container.
     * @param {number} width - Actual page width.
     */
    async renderPageAnnotationLayer(page, container, width) {
      pdf.AnnotationLayer.render({
        annotations: await page.getAnnotations(),
        div: container,
        linkService: this.linkService,
        page,
        renderInteractiveForms: false,
        viewport: page
          .getViewport({
            scale: width / page.view[2],
          })
          .clone({
            dontFlip: true,
          }),
      })
    },
    /**
     * Renders the text layer for the specified page.
     * @param {PDFPageProxy} page - Page proxy.
     * @param {HTMLElement} container - HTML container.
     * @param {number} width - Actual page width.
     */
    async renderPageTextLayer(page, container, width) {
      await pdf.renderTextLayer({
        container,
        textContent: await page.getTextContent(),
        viewport: page.getViewport({
          scale: width / page.view[2],
        }),
      }).promise
    },
  },
}
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
