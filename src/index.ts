import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import { useVuePdfEmbed } from './composables'
import VuePdfEmbed from './VuePdfEmbed.vue'

if (window?.Vue) {
  window.VuePdfEmbed = VuePdfEmbed
  window.useVuePdfEmbed = useVuePdfEmbed
}

if (!GlobalWorkerOptions?.workerSrc) {
  GlobalWorkerOptions.workerSrc = PdfWorker
}

export { useVuePdfEmbed }
export default VuePdfEmbed
