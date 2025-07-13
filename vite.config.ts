import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import copy from 'rollup-plugin-copy'
import CleanCSS from 'clean-css'
import type { RollupOptions } from 'rollup'

export const rollupOptions: RollupOptions = {
  external: ['pdfjs-dist', 'vue'],
  output: {
    globals: {
      'pdfjs-dist': 'pdfjsLib',
      vue: 'Vue',
    },
    compact: true,
    inlineDynamicImports: true,
  },
}

export default defineConfig({
  plugins: [
    copy({
      hook: 'writeBundle',
      targets: Object.entries({
        textLayer: [
          [3103, 3122],
          [582, 709],
        ],
        annotationLayer: [
          [3103, 3122],
          [710, 1074],
        ],
      }).map(([key, ranges]) => ({
        src: 'node_modules/pdfjs-dist/web/pdf_viewer.css',
        dest: 'dist/styles',
        rename: `${key}.css`,
        transform: (contents) => {
          const lines = contents.toString().split('\n')
          const css = ranges.reduce((acc, [start, end]) => {
            return acc + lines.slice(start, end).join('\n')
          }, '')
          return new CleanCSS().minify(css).styles + '\n'
        },
      })),
    }),
    vue(),
  ],
  build: {
    lib: {
      entry: new URL('./src/index.ts', import.meta.url).pathname,
      name: 'VuePdfEmbed',
      fileName: 'index',
    },
    rollupOptions,
  },
})
