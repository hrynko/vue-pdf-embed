/* eslint-disable no-undef */

import VuePdfEmbed from './vue-pdf-embed.vue'

function install(Vue) {
  if (install.installed) {
    return
  }

  install.installed = true
  Vue.component('VuePdfEmbed', VuePdfEmbed)
}

const plugin = {
  install,
}

let GlobalVue = null

if (typeof window !== 'undefined') {
  GlobalVue = window.Vue
} else if (typeof global !== 'undefined') {
  GlobalVue = global.vue
}

if (GlobalVue) {
  GlobalVue.use(plugin)
}

VuePdfEmbed.install = install

export default VuePdfEmbed
