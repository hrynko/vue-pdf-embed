# 📄 vue-pdf-embed

PDF embed component for Vue 2 and Vue 3

[![Awesome](https://raw.githubusercontent.com/sindresorhus/awesome/main/media/mentioned-badge.svg)](https://github.com/vuejs/awesome-vue)
[![npm](https://img.shields.io/npm/v/vue-pdf-embed)](https://npmjs.com/package/vue-pdf-embed)
[![npm](https://img.shields.io/npm/dm/vue-pdf-embed)](https://npmjs.com/package/vue-pdf-embed)
[![GitHub Repo stars](https://img.shields.io/github/stars/hrynko/vue-pdf-embed)](https://github.com/hrynko/vue-pdf-embed)
[![npm](https://img.shields.io/npm/l/vue-pdf-embed)](https://github.com/hrynko/vue-pdf-embed/blob/master/LICENSE)

## Features

- Controlled rendering of PDF documents in Vue apps
- Handles password protected documents
- Includes text layer (searchable and selectable documents)
- Includes annotation layer (annotations and links)
- No peer dependencies or additional configuration required
- Can be used directly in the browser (see [Examples](#examples))

## Compatibility

This package is compatible with both Vue 2 and Vue 3, but consists of two separate builds. The default exported build is for Vue 3, for Vue 2 import `dist/vue2-pdf-embed.js` (see [Usage](#usage)).

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
      source2: 'data:application/pdf;base64,<BASE64_ENCODED_PDF>',
    }
  }
}
</script>
```

### Props

| Name                   | Type                   | Accepted values                                  | Description                                                                |
| ---------------------- | ---------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| disableAnnotationLayer | `boolean`              | `true` or `false`                                | whether the annotation layer should be disabled                            |
| disableTextLayer       | `boolean`              | `true` or `false`                                | whether the text layer should be disabled                                  |
| height                 | `number` <br> `string` | natural numbers                                  | desired page height in pixels (ignored if the width property is specified) |
| page                   | `number`               | `1` to the last page number                      | number of the page to display (displays all pages if not specified)        |
| source                 | `string` <br> `object` <br> `Uint8Array` | document URL or typed array pre-filled with data | source of the document to display                                          |
| width                  | `number` <br> `string` | natural numbers                                  | desired page width in pixels                                               |

### Events

| Name                  | Value                         | Description                                |
| --------------------- | ----------------------------- | ------------------------------------------ |
| internal-link-clicked | destination page number       | internal link was clicked                  |
| loading-failed        | error object                  | failed to load document                    |
| password-requested    | callback function, retry flag | password is needed to display the document |
| rendering-failed      | error object                  | failed to render document                  |
| rendered              | –                             | finished rendering the document            |

## Examples

[Basic Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/ct6p8r7k)

[Advanced Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/we7p5uq4)

## License

MIT License. Please see [LICENSE file](LICENSE) for more information.
