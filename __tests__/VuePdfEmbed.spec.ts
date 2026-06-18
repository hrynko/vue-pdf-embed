import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { markRaw } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import {
  createMockDoc,
  createMockLoadingTask,
  createMockPage,
} from './mocks/pdfjs'
import VuePdfEmbed from '../src/VuePdfEmbed.vue'

const mockGetDocument = vi.fn()

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  AnnotationLayer: vi.fn().mockImplementation(() => ({ render: vi.fn() })),
  TextLayer: vi.fn().mockImplementation(() => ({ render: vi.fn() })),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}))

vi.mock('pdfjs-dist/legacy/web/pdf_viewer.mjs', () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    dispatch: vi.fn(),
  })),
  PDFFindController: vi.fn().mockImplementation(({ eventBus }) => ({
    _eventBus: eventBus,
    setDocument: vi.fn(),
  })),
  PDFLinkService: vi.fn().mockImplementation(() => ({
    setDocument: vi.fn(),
    setViewer: vi.fn(),
  })),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('VuePdfEmbed', () => {
  describe('document loading', () => {
    it('should expose doc after loading', async () => {
      const mockDoc = createMockDoc()
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.vm.doc).toBe(mockDoc)
    })

    it('should expose null doc when source is null', async () => {
      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: null,
        },
      })

      await flushPromises()
      expect(wrapper.vm.doc).toBeNull()
    })

    it('should load doc when source changes from null to a value', async () => {
      const mockDoc = createMockDoc()
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: null,
        },
      })

      await flushPromises()
      expect(wrapper.vm.doc).toBeNull()
      await wrapper.setProps({ source: 'test.pdf' })
      await flushPromises()
      expect(wrapper.vm.doc).toBe(mockDoc)
    })

    it('should accept a PDFDocumentProxy as source', async () => {
      const mockDoc = markRaw(createMockDoc())

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: mockDoc as unknown as PDFDocumentProxy,
        },
      })

      await flushPromises()
      expect(mockGetDocument).not.toHaveBeenCalled()
      expect(wrapper.vm.doc).toBe(mockDoc)
    })
  })

  describe('page IDs', () => {
    it('should set root and page IDs based on the id prop', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          id: 'ID',
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.find('#ID.vue-pdf-embed').exists()).toBe(true)
      expect(wrapper.find('#ID-0.vue-pdf-embed__page').exists()).toBe(false)
      expect(wrapper.find('#ID-1.vue-pdf-embed__page').exists()).toBe(true)
      expect(wrapper.find('#ID-2.vue-pdf-embed__page').exists()).toBe(true)
      expect(wrapper.find('#ID-3.vue-pdf-embed__page').exists()).toBe(true)
      expect(wrapper.find('#ID-4.vue-pdf-embed__page').exists()).toBe(false)
    })

    it('should not render ID attributes when id prop is absent', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.find('.vue-pdf-embed').attributes('id')).toBeUndefined()
      wrapper.findAll('.vue-pdf-embed__page').forEach((page) => {
        expect(page.attributes('id')).toBeUndefined()
      })
    })
  })

  describe('page selection', () => {
    it('should render all pages when page prop is not set', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.findAll('.vue-pdf-embed__page').length).toBe(3)
    })

    it('should render all pages when page is 0', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          page: 0,
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.findAll('.vue-pdf-embed__page').length).toBe(3)
    })

    it('should render specified pages and react to page prop changes', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          page: 2,
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.findAll('.vue-pdf-embed__page').length).toBe(1)
      await wrapper.setProps({ page: [1, 3] })
      await flushPromises()
      expect(wrapper.findAll('.vue-pdf-embed__page').length).toBe(2)
    })

    it('should emit rendering-failed for an out-of-range page number', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          page: 4,
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.emitted('rendering-failed')).toBeTruthy()
      expect(wrapper.findAll('.vue-pdf-embed__page').length).toBe(0)
    })
  })

  describe('events', () => {
    it('should emit loaded with the document proxy', async () => {
      const mockDoc = createMockDoc()
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.emitted('loaded')).toBeTruthy()
      expect(wrapper.emitted('loaded')![0][0]).toBe(mockDoc)
    })

    it('should emit rendered after pages render', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.emitted('rendered')).toBeTruthy()
    })

    it('should emit loading-failed when document loading fails', async () => {
      const error = new Error('load failed')
      mockGetDocument.mockReturnValue({
        promise: Promise.reject(error),
        onPassword: null,
        onProgress: null,
        destroy: vi.fn(),
      })

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.emitted('loading-failed')).toBeTruthy()
      expect(wrapper.emitted('loading-failed')![0][0]).toBe(error)
    })

    it('should emit rendering-failed when page rendering fails', async () => {
      const renderError = new Error()
      mockGetDocument.mockReturnValue(
        createMockLoadingTask(
          createMockDoc(1, {
            getPage: vi.fn(() =>
              Promise.resolve(
                createMockPage({
                  render: vi.fn(() => ({
                    promise: Promise.reject(renderError),
                  })),
                })
              )
            ),
          })
        )
      )

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.emitted('rendering-failed')).toBeTruthy()
      expect(wrapper.emitted('rendering-failed')![0][0]).toBe(renderError)
    })
  })

  describe('slots', () => {
    it('should render before-page and after-page content', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
        },
        slots: {
          'after-page': 'AFTER',
          'before-page': 'BEFORE',
        },
      })

      await flushPromises()
      expect(wrapper.html()).toContain('AFTER')
      expect(wrapper.html()).toContain('BEFORE')
    })

    it('should provide the page number as scoped slot data', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          page: 2,
          source: 'test.pdf',
        },
        slots: {
          'before-page':
            '<template #before-page="{ page }">PAGE-{{ page }}</template>',
        },
      })

      await flushPromises()
      expect(wrapper.html()).toContain('PAGE-2')
    })
  })

  describe('conditional layers', () => {
    it('should render textLayer div when textLayer prop is true', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
          textLayer: true,
        },
      })

      await flushPromises()
      expect(wrapper.find('.textLayer').exists()).toBe(true)
    })

    it('should render annotationLayer div when annotationLayer prop is true', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          annotationLayer: true,
          source: 'test.pdf',
        },
      })

      await flushPromises()
      expect(wrapper.find('.annotationLayer').exists()).toBe(true)
    })
  })

  describe('search', () => {
    it('should expose search controls', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          source: 'test.pdf',
          textLayer: true,
        },
      })

      await flushPromises()
      const vm = wrapper.vm as unknown as { search: Record<string, unknown> }
      expect(typeof vm.search.find).toBe('function')
      expect(typeof vm.search.next).toBe('function')
      expect(typeof vm.search.previous).toBe('function')
      expect((vm.search.matchCount as { value: number }).value).toBe(0)
      expect(() => (vm.search.find as (q: string) => void)('foo')).not.toThrow()
    })

    it('should not expose search controls when controller is provied', async () => {
      mockGetDocument.mockReturnValue(createMockLoadingTask(createMockDoc()))

      const wrapper = mount(VuePdfEmbed, {
        props: {
          findController: {} as never,
          source: 'test.pdf',
          textLayer: true,
        },
      })

      await flushPromises()
      const vm = wrapper.vm as unknown as Record<string, unknown>
      expect(vm.search).toBeUndefined()
    })
  })
})
