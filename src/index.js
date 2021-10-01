import VuePdfEmbed from './vue-pdf-embed.vue'

if (typeof window !== 'undefined' && window.Vue) {
  window.VuePdfEmbed = VuePdfEmbed
}

export default VuePdfEmbed
