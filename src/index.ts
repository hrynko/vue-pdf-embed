import VuePdfEmbed from './vue-pdf-embed.vue'
import { getDocument } from 'pdfjs-dist/build/pdf'

VuePdfEmbed.getDocument = getDocument

if (typeof window !== 'undefined' && window.Vue) {
  window.VuePdfEmbed = VuePdfEmbed
}

export default VuePdfEmbed
