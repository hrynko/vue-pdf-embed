import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
    minify: false,
    target: 'esnext',
  },
  plugins: [
    vue({}),
    dts(),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: '__tla',
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: (i) => `__tla_${i}`,
    }),
  ],
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
})
