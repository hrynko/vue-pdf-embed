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
     * Component identifier (inherited by child SVGs with page number
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
      type: [Object, String],
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
     * Returns an array of the actual width and height of the page.
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
     * Renders the PDF document as SVG element(s).
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
            const viewport = page.getViewport({
              scale: Math.ceil(actualWidth / page.view[2]) + 1,
            })

            canvas.width = viewport.width
            canvas.height = viewport.height
            canvas.style.width = `${Math.floor(actualWidth)}px`
            canvas.style.height = `${Math.floor(actualHeight)}px`

            await page.render({
              canvasContext: canvas.getContext('2d'),
              viewport,
            }).promise

            if (!this.disableTextLayer) {
              await pdf.renderTextLayer({
                container: div1,
                textContent: await page.getTextContent(),
                viewport: page.getViewport({
                  scale: actualWidth / page.view[2],
                }),
              }).promise
            }

            if (!this.disableAnnotationLayer) {
              const linkService = new PDFLinkService()
              linkService.setDocument(this.document)
              linkService.setViewer({
                scrollPageIntoView: ({ pageNumber }) => {
                  this.$emit('internal-link-clicked', pageNumber)
                },
              })

              pdf.AnnotationLayer.render({
                annotations: await page.getAnnotations(),
                div: this.disableTextLayer ? div1 : div2,
                linkService,
                page,
                renderInteractiveForms: false,
                viewport: page
                  .getViewport({
                    scale: actualWidth / page.view[2],
                  })
                  .clone({
                    dontFlip: true,
                  }),
              })
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
