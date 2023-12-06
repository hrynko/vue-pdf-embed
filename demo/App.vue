<template>
  <div>
    <button @click="currentPage++">Increment</button>

    <vue-pdf-embed
      :image-resources-path="annotationIconsPath"
      :source="pdfSource"
      :page="currentPage"
      @loaded="debug('loaded')"
      @no-source="debug('no-source')"
      @progress="debug('progress')"
      @rendering-failed="debug('rendering-failed')"
    />
  </div>
</template>

<script lang="ts">
import VuePdfEmbed from '../src/vue-pdf-embed.vue'
import testPdf from './test2.pdf?url'

export default {
  components: {
    VuePdfEmbed,
  },
  data() {
    return {
      annotationIconsPath: '/node_modules/pdfjs-dist/web/images/',
      pdfSource: testPdf,
      currentPage: 1,
    }
  },
  methods: {
    debug(type) {
      return (...args) => {
        console.log(type, ...args)
      }
    },
  },
}
</script>

<style lang="scss">
body {
  padding: 16px;
  background-color: #ccc;
}

.vue-pdf-embed {
  margin: auto;
  max-width: 480px;

  & > div {
    margin-bottom: 4px;
    box-shadow: 0 2px 8px 4px rgba(0, 0, 0, 0.1);
  }
}
</style>
