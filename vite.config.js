import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

module.exports = defineConfig({
  plugins: [vue()],
  build: {
    root: 'demo',
    emptyOutDir: true,
    minify: false,
  },
})
