import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'VuePdfEmbed',
      fileName: (format) => `vue-pdf-embed.${format}.js`,
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
    minify: false,
  },
  plugins: [vue()],
})
