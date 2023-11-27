import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import copy from 'rollup-plugin-copy'
import CleanCSS from 'clean-css'

const globals = {
  'pdfjs-dist': 'PDFJS',
  vue: 'Vue',
}

export default defineConfig({
  plugins: [
    copy({
      hook: 'writeBundle',
      targets: Object.entries({
        textLayer: [0, 107],
        annotationLayer: [109, 385],
      }).map(([key, [start, end]]) => ({
        src: 'node_modules/pdfjs-dist/web/pdf_viewer.css',
        dest: 'dist/style',
        rename: `${key}.css`,
        transform: (contents) => {
          const css = contents
            .toString()
            .split('\n')
            .slice(start, end)
            .join('\n')
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
    rollupOptions: {
      external: Object.keys(globals),
      output: {
        globals,
        assetFileNames: (assetInfo) => {
          switch (assetInfo.name) {
            case 'style.css':
              return 'style/index.css'
            default:
              return assetInfo.name as string
          }
        },
      },
    },
  },
})
