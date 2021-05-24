<template>
  <div>
    <canvas v-for="pageNum in pageNums" :key="pageNum"></canvas>
  </div>
</template>

<script>
import * as pdf from 'pdfjs-dist/es5/build/pdf.js'
import PdfWorker from 'pdfjs-dist/es5/build/pdf.worker.js'

pdf.GlobalWorkerOptions.workerPort = new PdfWorker()

export default {
  name: 'VuePdfEmbed',
  props: {
    page: Number,
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
    async load() {
      if (!this.source) {
        return
      }

      try {
        this.document = await pdf.getDocument(this.source).promise
        this.pageCount = this.document.numPages
      } catch (e) {
        this.document = null
        this.pageCount = null
        this.pageNums = []
        this.$emit('loading-failed', e)
      }
    },
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
            const canvas = this.$el.children[i]
            const viewport = page.getViewport({
              scale: this.$el.clientWidth / page.view[2],
            })

            canvas.height = viewport.height
            canvas.width = viewport.width

            await page.render({
              canvasContext: canvas.getContext('2d'),
              viewport,
            }).promise
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
