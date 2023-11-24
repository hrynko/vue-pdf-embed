import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const globals = {
  'pdfjs-dist': 'PDFJS',
  vue: 'Vue',
}

export default defineConfig({
  plugins: [vue()],
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
      },
    },
  },
})
