import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import { usePdfDocument, usePdfSearch, useVuePdfEmbed } from './composables'
import VuePdfEmbed from './VuePdfEmbed.vue'

if (typeof window !== 'undefined' && window.Vue) {
  window.VuePdfEmbed = VuePdfEmbed
  window.usePdfDocument = usePdfDocument
  window.usePdfSearch = usePdfSearch
  window.useVuePdfEmbed = useVuePdfEmbed
}

if (!GlobalWorkerOptions?.workerSrc) {
  GlobalWorkerOptions.workerSrc = PdfWorker
}

export { usePdfDocument, usePdfSearch, useVuePdfEmbed } from './composables'
export default VuePdfEmbed
