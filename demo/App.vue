<template>
  <div>
    <vue-pdf-embed :source="pdfSource" />
  </div>
</template>

<script>
import VuePdfEmbed from '../src/vue-pdf-embed.vue'

export default {
  components: {
    VuePdfEmbed,
  },
  data() {
    return {
      pdfSource:
        'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf',
    }
  },
}
</script>

<style>
body {
  padding: 16px;
  background-color: #ccc;
}

canvas {
  display: block;
  margin: auto;
  max-width: 480px;
  box-shadow: 0 2px 8px 4px rgba(0, 0, 0, 0.1);
}
</style>
