# 📄 vue-pdf-embed

PDF embed component for Vue 3 (see [Compatibility](#compatibility) for Vue 2 support)

[![Awesome List](https://raw.githubusercontent.com/sindresorhus/awesome/main/media/mentioned-badge.svg)](https://github.com/vuejs/awesome-vue)
[![npm Version](https://img.shields.io/npm/v/vue-pdf-embed?style=flat)](https://npmjs.com/package/vue-pdf-embed)
[![npm Downloads](https://img.shields.io/npm/dm/vue-pdf-embed?style=flat)](https://npmjs.com/package/vue-pdf-embed)
[![GitHub Stars](https://img.shields.io/github/stars/hrynko/vue-pdf-embed?style=flat)](https://github.com/hrynko/vue-pdf-embed)
[![License](https://img.shields.io/npm/l/vue-pdf-embed?style=flat)](https://github.com/hrynko/vue-pdf-embed/blob/main/LICENSE)

## Features

- Controlled rendering of PDF documents in Vue apps
- Handling password-protected documents
- Includes text layer (searchable and selectable documents)
- Includes annotation layer (annotations and links)
- No peer dependencies or additional configuration required
- Can be used directly in the browser (see [Examples](#examples))

## Compatibility

This package is only compatible with Vue 3. For Vue 2 support, install `vue-pdf-embed@1` and refer to the [v1 docs](https://github.com/hrynko/vue-pdf-embed/tree/v1).

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
<script setup>
import VuePdfEmbed from 'vue-pdf-embed'

// essential styles
import 'vue-pdf-embed/dist/style/index.css'

// optional styles
import 'vue-pdf-embed/dist/style/annotationLayer.css'
import 'vue-pdf-embed/dist/style/textLayer.css'

// either URL, Base64, binary, or document proxy
const pdfSource = '<PDF_URL>'
</script>

<template>
  <VuePdfEmbed annotation-layer text-layer :source="pdfSource" />
</template>
```

### Props

| Name               | Type                   | Accepted values                                         | Description                                                                |
| ------------------ | ---------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| annotationLayer    | `boolean`              | `true` or `false`                                       | whether the annotation layer should be enabled                             |
| height             | `number`               | natural numbers                                         | desired page height in pixels (ignored if the width property is specified) |
| imageResourcesPath | `string`               | URL or path with trailing slash                         | path for icons used in the annotation layer                                |
| page               | `number`               | `1` to the last page number                             | number of the page to display (displaying all pages if not specified)      |
| rotation           | `number`               | `0`, `90`, `180`, `270` (multiples of `90`)             | desired page rotation angle in degrees                                     |
| scale              | `number`               | rational numbers                                        | desired page viewport scale                                                |
| source             | `string` <br> `object` | document URL or Base64 or typed array or document proxy | source of the document to display                                          |
| textLayer          | `boolean`              | `true` or `false`                                       | whether the text layer should be enabled                                   |
| width              | `number`               | natural numbers                                         | desired page width in pixels                                               |

### Events

| Name                  | Value                                                                   | Description                                |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| internal-link-clicked | destination page number                                                 | internal link was clicked                  |
| loaded                | PDF document proxy                                                      | finished loading the document              |
| loading-failed        | error object                                                            | failed to load document                    |
| password-requested    | object with `callback` function and `isWrongPassword` flag              | password is needed to display the document |
| progress              | object with number of `loaded` pages along with `total` number of pages | tracking document loading progress         |
| rendered              | –                                                                       | finished rendering the document            |
| rendering-failed      | error object                                                            | failed to render document                  |

### Slots

| Name        | Props                | Description                          |
| ----------- | -------------------- | ------------------------------------ |
| after-page  | `page` (page number) | content to be added after each page  |
| before-page | `page` (page number) | content to be added before each page |

### Public Methods

| Name     | Arguments                                                                    | Description                          |
| -------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| download | filename (`string`)                                                          | download document                    |
| print    | print resolution (`number`), filename (`string`), all pages flag (`boolean`) | print document via browser interface |

**Note:** Public methods can be accessed through a [template ref](https://vuejs.org/guide/essentials/template-refs.html).

## Common Issues and Caveats

### Server-Side Rendering

This is a client-side library, so it is important to keep this in mind when working with SSR (server-side rendering) frameworks such as Nuxt. Depending on the framework used, you may need to properly configure the library import or use a wrapper.

### Web Worker Loading

The web worker used to handle PDF documents is loaded by default. However, this may not be acceptable due to bundler restrictions or CSP (Content Security Policy). In such cases it is recommended to use the essential build (`index.essential.mjs`) and set up the worker manually using the exposed `GlobalWorkerOptions`.

```js
import { GlobalWorkerOptions } from 'vue-pdf-embed/dist/index.essential.mjs'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.js?url'

GlobalWorkerOptions.workerSrc = PdfWorker
```

### Document Loading

Typically, document loading is internally handled within the component. However, for optimization purposes, the document can be loaded in the `useVuePdfEmbed` composable function and then passed as the `source` prop of the component (e.g. when sharing the source between multiple instances of the component).

```vue
<script setup>
import VuePdfEmbed, { useVuePdfEmbed } from 'vue-pdf-embed'

const { doc } = useVuePdfEmbed({
  source: '<PDF_URL>',
})
</script>

<template>
  <VuePdfEmbed :source="doc" />
</template>
```

### Resources

The path to predefined CMaps should be specified to ensure correct rendering of documents containing non-Latin characters, as well as in case of CMap-related errors:

```vue
<VuePdfEmbed
  :source="{
    cMapUrl: 'https://unpkg.com/pdfjs-dist/cmaps/',
    url: pdfSource,
  }"
/>
```

The image resource path must be specified for annotations to display correctly:

```vue
<VuePdfEmbed
  image-resources-path="https://unpkg.com/pdfjs-dist/web/images/"
  :source="pdfSource"
/>
```

**Note:** The examples above use a CDN to load resources, however these resources can also be included in the build by installing the `pdfjs-dist` package as a dependency and further configuring the bundler.

## Examples

[Basic Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/atcn32yp)

[Advanced Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/273a59qr)

## License

MIT License. Please see [LICENSE file](LICENSE) for more information.
