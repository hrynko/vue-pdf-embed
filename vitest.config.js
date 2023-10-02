import { defineConfig, mergeConfig } from 'vite'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
    },
  })
)
