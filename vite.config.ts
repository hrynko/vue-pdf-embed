import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import copy, { type CopyOptions } from 'rollup-plugin-copy'
import vue from '@vitejs/plugin-vue'
import postcss from 'postcss'
import cssnano from 'cssnano'
import selectorParser from 'postcss-selector-parser'

const cssCopyOptions: CopyOptions = {
  hook: 'writeBundle',
  targets: ['annotationLayer', 'textLayer'].map((layer) => ({
    src: 'node_modules/pdfjs-dist/web/pdf_viewer.css',
    dest: 'dist/styles',
    rename: `${layer}.css`,
    transform: async (contents) => {
      const commonAtRules = new Map<string, Map<string, postcss.AtRule>>()
      const result = postcss.root()
      const targets = new Set([
        '[data-main-rotation="90"]',
        '[data-main-rotation="180"]',
        '[data-main-rotation="270"]',
        `.${layer}`,
      ])

      postcss.parse(contents.toString()).walkRules((rule: postcss.Rule) => {
        let hasTarget = false
        selectorParser((selectors) => {
          hasTarget ||= selectors.some(
            (selector) =>
              (selector.first.type !== 'attribute' || selector.length === 1) &&
              targets.has(selector.first.toString())
          )
        }).processSync(rule.selector)

        if (hasTarget) {
          let container: postcss.Root | postcss.AtRule = result

          const ancestorAtRules: Array<{ name: string; params: string }> = []
          for (let p = rule.parent; p?.type === 'atrule'; p = p.parent) {
            ancestorAtRules.unshift({ name: p.name, params: p.params })
          }

          for (const { name, params } of ancestorAtRules) {
            let parentAtRule = commonAtRules.get(name)
            if (!parentAtRule) {
              parentAtRule = new Map()
              commonAtRules.set(name, parentAtRule)
            }
            let atRule = parentAtRule.get(params)
            if (!atRule) {
              atRule = postcss.atRule({ name, params })
              parentAtRule.set(params, atRule)
              container.append(atRule)
            }
            container = atRule
          }

          container.append(rule.clone())
        }
      })

      return (await postcss([cssnano()]).process(result)).css
    },
  })),
}

export default defineConfig({
  plugins: [copy(cssCopyOptions), vue()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'VuePdfEmbed',
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
        inlineDynamicImports: true,
      },
    },
  },
})
