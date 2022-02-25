<template>
  <div :id="id" class="vue-pdf-embed">
    <div
      v-for="pageNum in pageNums"
      :key="pageNum"
      :id="id && `${id}-${pageNum}`"
    >
      <canvas />

      <div v-if="!disableTextLayer" class="textLayer" />
    </div>
  </div>
</template>

<script>
import * as pdf from 'pdfjs-dist/legacy/build/pdf.js'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.js'

pdf.GlobalWorkerOptions.workerPort = new PdfWorker()

export default {
  name: 'VuePdfEmbed',
  props: {
    /**
     * Whether the text layer should be disabled.
     * @values Boolean
     */
    disableTextLayer: Boolean,
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
  },
  data() {
    return {
      document: null,
      pageCount: null,
      pageNums: [],
    }
  },
  watch: {
    disableTextLayer() {
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
  },
  methods: {
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
            const [canvas, textLayerDiv] = this.$el.children[i].children
            const actualWidth = this.$el.clientWidth
            const actualHeight = (width * page.view[3]) / page.view[2]
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
                container: textLayerDiv,
                textContent: await page.getTextContent(),
                viewport: page.getViewport({
                  scale: actualWidth / page.view[2],
                }),
              }).promise
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

.vue-pdf-embed {
  & > div {
    position: relative;
  }

  canvas {
    display: block;
  }
}
</style>
