import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

module.exports = defineConfig({
  plugins: [vue()],
  build: {
    emptyOutDir: true,
    minify: false,
  },
})
