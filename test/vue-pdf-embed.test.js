import Vue from 'vue'
import VuePdfEmbed from '../src/vue-pdf-embed.vue'

HTMLCanvasElement.prototype.getContext = () => {}

jest.mock('pdfjs-dist/legacy/build/pdf.worker.js', () => jest.fn())

jest.mock('pdfjs-dist/legacy/build/pdf.js', () => ({
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
  vm = new Component({
    propsData: {
      disableAnnotationLayer: true,
      disableTextLayer: true,
      source: 'SOURCE',
    },
  }).$mount()
  emitSpy = jest.spyOn(vm, '$emit')
})

test('sets correct data', () => {
  expect(vm.document).toBeTruthy()
  expect(vm.pageCount).toBe(5)
  expect(vm.pageNums).toEqual([1, 2, 3, 4, 5])
})

test('sets page IDs', async () => {
  vm.id = 'ID'
  await vm.$nextTick()
  vm.$el.childNodes.forEach((node, i) => {
    expect(node.id).toEqual(`ID-${i + 1}`)
  })
})

test('emits "rendered" event', async () => {
  await vm.$nextTick()
  await vm.$nextTick()
  expect(emitSpy).lastCalledWith('rendered')
})
