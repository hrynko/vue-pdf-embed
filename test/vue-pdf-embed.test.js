import Vue from 'vue'
import VuePdfEmbed from '../src/vue-pdf-embed.vue'

HTMLCanvasElement.prototype.getContext = () => {}

jest.mock('pdfjs-dist/es5/build/pdf.worker.js', () => jest.fn())

jest.mock('pdfjs-dist/es5/build/pdf.js', () => ({
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

const Component = Vue.extend(VuePdfEmbed)
let vm, emitSpy

beforeEach(() => {
  vm = new Component({ propsData: { source: 'SOURCE' } }).$mount()
  emitSpy = jest.spyOn(vm, '$emit')
})

test('sets correct data', () => {
  expect(vm.document).toBeTruthy()
  expect(vm.pageCount).toBe(5)
  expect(vm.pageNums).toEqual([1, 2, 3, 4, 5])
})

test('emits "rendered" event', async () => {
  await vm.$nextTick()
  expect(emitSpy).lastCalledWith('rendered')
})
