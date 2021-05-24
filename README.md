# vue-pdf-embed

PDF embed component for Vue 2 and Vue 3

## Compatibility

This package is compatible with both Vue 2 and Vue 3, but is delievered in separate builds. Use `dist/vue2-pdf-embed.js` for Vue 2 and `dist/vue3-pdf-embed.js` for Vue 3. The default export of the package is for Vue 3.

## Usage

```vue
<template>
  <div>
    <h1>File</h1>

    <vue-pdf-embed :source="source1" />

    <h1>Base64</h1>

    <vue-pdf-embed :source="source2" />
  </div>
</template>

<script>
import VuePdfEmbed from 'vue-pdf-embed'

// OR THE FOLLOWING IMPORT FOR VUE 2
// import VuePdfEmbed from 'vue-pdf-embed/dist/vue2-pdf-embed'

export default {
  components: {
    VuePdfEmbed,
  },
  data() {
    return {
      source1: '<PDF_URL>',
      source2: {
        data: atob('<BASE64_ENCODED_PDF>'),
      },
    }
  }
})
</script>
```

### Props

| Name   | Type            | Accepted values                                  | Description                                                         |
| ------ | --------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| page   | number          | 1 to the number of the last page                 | number of the page to display (displays all pages if not specified) |
| source | string / object | document URL or typed array pre-filled with data | source of the document to display                                   |

### Events

| Name             | Description                     |
| ---------------- | ------------------------------- |
| loading-failed   | failed to load document         |
| rendering-failed | failed to render document       |
| rendered         | finished rendering the document |
