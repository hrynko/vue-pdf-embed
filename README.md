# 📄 vue-pdf-embed

PDF embed component for Vue 2 and Vue 3

[![npm](https://img.shields.io/npm/v/vue-pdf-embed)](https://npmjs.com/package/vue-pdf-embed)
[![npm](https://img.shields.io/npm/dm/vue-pdf-embed)](https://npmjs.com/package/vue-pdf-embed)
[![GitHub Repo stars](https://img.shields.io/github/stars/hrynko/vue-pdf-embed)](https://github.com/hrynko/vue-pdf-embed)
[![npm](https://img.shields.io/npm/l/vue-pdf-embed)](https://github.com/hrynko/vue-pdf-embed/blob/master/LICENSE)

## Compatibility

This package is compatible with both Vue 2 and Vue 3, but is delievered in separate builds. Use `dist/vue2-pdf-embed.js` for Vue 2 and `dist/vue3-pdf-embed.js` for Vue 3. The default export of the package is for Vue 3.

## Installation

Depending on the environment, the package can be installed in one of the following ways:

```shell
npm install vue-pdf-embed
```

```shell
yarn add vue-pdf-embed
```

```html
<script src="https://unpkg.com/vue-pdf-embed"></script>
```

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

| Name   | Type                   | Accepted values                                  | Description                                                         |
| ------ | ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| page   | `number`               | 1 to the number of the last page                 | number of the page to display (displays all pages if not specified) |
| source | `string` <br> `object` | document URL or typed array pre-filled with data | source of the document to display                                   |

### Events

| Name               | Value                         | Description                                |
| ------------------ | ----------------------------- | ------------------------------------------ |
| loading-failed     | error object                  | failed to load document                    |
| password-requested | callback function, retry flag | password is needed to display the document |
| rendering-failed   | error object                  | failed to render document                  |
| rendered           | –                             | finished rendering the document            |

## Examples

[Basic Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/ct6p8r7k)

[Advanced Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/we7p5uq4)

## License

MIT License. Please see [LICENSE file](LICENSE) for more information.
