import { useVuePdfEmbed } from './composable'
import VuePdfEmbed from './VuePdfEmbed.vue'

if (window?.Vue) {
  window.VuePdfEmbed = VuePdfEmbed
  window.useVuePdfEmbed = useVuePdfEmbed
}

export { useVuePdfEmbed }
export default VuePdfEmbed
