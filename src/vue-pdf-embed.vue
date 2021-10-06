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
            const scale = Math.ceil(this.$el.clientWidth / page.view[2]) + 1
            const viewport = page.getViewport({
              scale,
            })

            canvas.width = viewport.width
            canvas.height = viewport.height
            canvas.style.width = '100%'
            canvas.style.height = '100%'

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
