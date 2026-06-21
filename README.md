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

// Optional styles
import 'vue-pdf-embed/dist/styles/annotationLayer.css'
import 'vue-pdf-embed/dist/styles/textLayer.css'

// Either URL, Base64, binary, or document proxy
const pdfSource = '<PDF_URL>'
</script>

<template>
  <VuePdfEmbed annotation-layer text-layer :source="pdfSource" />
</template>
```

### Props

| Name               | Type                                           | Accepted values                                         | Description                                                                               |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| annotationLayer    | `boolean`                                      |                                                         | whether the annotation layer should be enabled                                            |
| findController     | `PDFFindController`                            |                                                         | find controller for highlighting text matches (requires `textLayer`)                      |
| forms              | `boolean`                                      |                                                         | whether interactive form fields should be rendered (requires `annotationLayer`)           |
| height             | `number`                                       | natural numbers                                         | desired page height in pixels (ignored if the width property is specified)                |
| imageResourcesPath | `string`                                       | URL or path with trailing slash                         | path for icons used in the annotation layer                                               |
| linkService        | `PDFLinkService`                               |                                                         | document navigation service (replaces the default one that emits `internal-link-clicked`) |
| page               | `number` <br> `number[]`                       | `1` to the last page number                             | page number(s) to display (displaying all pages if not specified)                         |
| rotation           | `number`                                       | `0`, `90`, `180`, `270` (multiples of `90`)             | desired page rotation angle in degrees                                                    |
| scale              | `number`                                       | rational numbers                                        | rendering resolution multiplier (controls sharpness)                                      |
| source             | `string` <br> `object` <br> `PDFDocumentProxy` | document URL or Base64 or typed array or document proxy | source of the document to display                                                         |
| textLayer          | `boolean`                                      |                                                         | whether the text layer should be enabled                                                  |
| width              | `number`                                       | natural numbers                                         | desired page width in pixels                                                              |

### Events

| Name                  | Value                                                      | Description                                    |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| internal-link-clicked | destination page number                                    | an internal link was clicked                   |
| loaded                | PDF document proxy                                         | finished loading the document                  |
| loading-failed        | error object                                               | failed to load the document                    |
| password-requested    | object with `callback` function and `isWrongPassword` flag | a password is required to display the document |
| progress              | object with `loaded` and `total` byte counts               | tracks the document's loading progress         |
| rendered              | –                                                          | finished rendering the document                |
| rendering-failed      | error object                                               | failed to render the document                  |

### Slots

| Name        | Props                | Description                          |
| ----------- | -------------------- | ------------------------------------ |
| after-page  | `page` (page number) | content to be added after each page  |
| before-page | `page` (page number) | content to be added before each page |

### Public Methods

| Name     | Arguments                                                                    | Description                                  |
| -------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| download | filename (`string`)                                                          | download the document                        |
| print    | print resolution (`number`), filename (`string`), all pages flag (`boolean`) | print the document via the browser interface |

**Note:** Public methods can be accessed through a [template ref](https://vuejs.org/guide/essentials/template-refs.html).

## Common Issues and Caveats

### Server-Side Rendering

This is a client-side library that relies on browser APIs and cannot be server-rendered. Wrap it in a client-only boundary (Nuxt's `<ClientOnly>` or equivalent); if that doesn't keep it out of the server bundle, also lazy-load it with `defineAsyncComponent`.

### Web Worker Loading

By default, the PDF.js web worker is bundled as a blob URL. This works out of the box, but it may be blocked by certain CSP (content security policy) configurations. In such cases, use the essential build and configure the worker manually:

```js
import VuePdfEmbed, {
  GlobalWorkerOptions,
} from 'vue-pdf-embed/dist/index.essential.mjs'

// Option 1: use a bundler URL import
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc = PdfWorker

// Option 2: serve the worker from your public directory,
// copied from pdfjs-dist/build/pdf.worker.min.mjs
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
```

### Document Loading

Typically, document loading is internally handled within the component. However, for optimization purposes, the document can be loaded with the `usePdfDocument` composable and then passed to the component via the `source` prop (e.g., when sharing the source between multiple instances of the component).

```vue
<script setup>
import VuePdfEmbed, { usePdfDocument } from 'vue-pdf-embed'

const { doc } = usePdfDocument({ source: '<PDF_URL>' })
</script>

<template>
  <VuePdfEmbed :source="doc" />
</template>
```

### Text Search

Full-text search over a loaded document is available through the `usePdfSearch` composable. Pass its `findController` to the `:find-controller` prop (with the text layer enabled) to highlight matches in place:

```vue
<script setup>
import VuePdfEmbed, { usePdfDocument, usePdfSearch } from 'vue-pdf-embed'

const { doc } = usePdfDocument({ source: '<PDF_URL>' })
const { find, findController } = usePdfSearch(doc)
</script>

<template>
  <input @keydown.enter="find($event.target.value)" />
  <VuePdfEmbed :find-controller="findController" text-layer :source="doc" />
</template>
```

### Resources

The path to predefined CMaps should be provided to ensure correct rendering of documents with non-Latin characters and to avoid CMap-related errors:

```vue
<VuePdfEmbed
  :source="{
    cMapUrl: 'https://unpkg.com/pdfjs-dist/cmaps/',
    url: '<PDF_URL>',
  }"
/>
```

The image resource path must be specified for annotations to display correctly:

```vue
<VuePdfEmbed
  image-resources-path="https://unpkg.com/pdfjs-dist/web/images/"
  source="<PDF_URL>"
/>
```

For documents containing JPEG 2000 or JBIG2 images, the path to WebAssembly decoders must be specified:

```vue
<VuePdfEmbed
  :source="{
    url: '<PDF_URL>',
    wasmUrl: 'https://unpkg.com/pdfjs-dist/wasm/',
  }"
/>
```

**Note:** The examples above use a CDN to load resources, however these resources can also be included in the build by installing the `pdfjs-dist` package as a dependency and further configuring the bundler.

## Examples

[Basic Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/atcn32yp)

[Advanced Usage Demo (JSFiddle)](https://jsfiddle.net/hrynko/273a59qr)

[Lazy Loading Demo (JSFiddle)](https://jsfiddle.net/hrynko/u149my7h)

## License

MIT License. Please see [LICENSE file](LICENSE) for more information.
