import { expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import VuePdfEmbed from '../src/vue-pdf-embed.vue'

vi.mock('pdfjs-dist/build/pdf.worker.min.js', () => vi.fn())

vi.mock('pdfjs-dist/legacy/build/pdf.js', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: {
      numPages: 5,
      getPage: () => ({
        view: [],
        getViewport: () => ({}),
        render: () => ({}),
      }),
    },
  }),
}))

test('sets correct data', () => {
  const wrapper = mount(VuePdfEmbed, { props: { source: 'SOURCE' } })
  expect(wrapper.componentVM.document).toBeTruthy()
  expect(wrapper.componentVM.pageCount).toBe(5)
  expect(wrapper.componentVM.pageNums).toEqual([1, 2, 3, 4, 5])
})
