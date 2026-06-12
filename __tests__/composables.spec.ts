import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, ref, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { PasswordResponses, type PDFDocumentProxy } from 'pdfjs-dist'

import { createMockDoc, createMockLoadingTask } from './mocks/pdfjs'
import { createPrintIframe, downloadPdf } from '../src/utils'
import { useVuePdfEmbed } from '../src/composables'

const mockGetDocument = vi.fn()

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', async (importOriginal) => {
  const originalModule =
    await importOriginal<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>()
  return {
    AnnotationMode: originalModule.AnnotationMode,
    PasswordResponses: originalModule.PasswordResponses,
    getDocument: (...args: unknown[]) => mockGetDocument(...args),
  }
})

vi.mock('../src/utils', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    addPrintStyles: vi.fn(),
    createPrintIframe: vi.fn((container: HTMLElement) => {
      const iframe = document.createElement('iframe')
      container.appendChild(iframe)
      if (iframe.contentWindow) {
        Object.assign(iframe.contentWindow, {
          print: vi.fn(),
          focus: vi.fn(),
        })
      }
      return Promise.resolve(iframe)
    }),
    downloadPdf: vi.fn(),
  }
})

const withSetup = (composable: () => ReturnType<typeof useVuePdfEmbed>) => {
  let result: ReturnType<typeof composable> | undefined
  const app = createApp({
    setup() {
      result = composable()
      return () => {}
    },
  })
  app.mount(document.createElement('div'))
  return { app, result: result! }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useVuePdfEmbed', () => {
  describe('document loading', () => {
    it('should load a PDF when source is a string URL', async () => {
      const mockDoc = createMockDoc()
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))
      const source = ref('http://localhost/test.pdf')

      const { app, result } = withSetup(() => useVuePdfEmbed({ source }))

      await flushPromises()
      expect(mockGetDocument).toHaveBeenCalledWith(source.value)
      expect(result.doc.value).toBe(mockDoc)
      app.unmount()
    })

    it('should set doc directly when source is a PDFDocumentProxy', async () => {
      const mockDoc = createMockDoc()
      const source = shallowRef(mockDoc as unknown as PDFDocumentProxy)

      const { app, result } = withSetup(() => useVuePdfEmbed({ source }))

      await flushPromises()
      expect(mockGetDocument).not.toHaveBeenCalled()
      expect(result.doc.value).toBe(mockDoc)
      app.unmount()
    })

    it('should not load when source is null', async () => {
      const { app, result } = withSetup(() => useVuePdfEmbed({ source: null }))

      await flushPromises()
      expect(mockGetDocument).not.toHaveBeenCalled()
      expect(result.doc.value).toBeNull()
      app.unmount()
    })

    it('should reload and destroy old doc when source changes', async () => {
      const mockDoc1 = createMockDoc(2)
      const mockDoc2 = createMockDoc(5)
      const mockLoadingTask1 = createMockLoadingTask(mockDoc1)
      const mockLoadingTask2 = createMockLoadingTask(mockDoc2)
      mockGetDocument.mockReturnValueOnce(mockLoadingTask1)
      const source = ref('http://localhost/test1.pdf')

      const { app, result } = withSetup(() => useVuePdfEmbed({ source }))

      await flushPromises()
      expect(result.doc.value).toBe(mockDoc1)
      mockGetDocument.mockReturnValueOnce(mockLoadingTask2)
      source.value = 'http://localhost/test2.pdf'
      await flushPromises()
      expect(result.doc.value).toBe(mockDoc2)
      expect(mockDoc1.destroy).toHaveBeenCalled()
      app.unmount()
    })
  })

  describe('error handling', () => {
    it('should call onError and set doc to null when loading fails', async () => {
      const error = new Error()
      mockGetDocument.mockReturnValue({
        promise: Promise.reject(error),
        onPassword: null,
        onProgress: null,
        destroy: vi.fn(),
      })
      const onError = vi.fn()

      const { app, result } = withSetup(() =>
        useVuePdfEmbed({ onError, source: 'bad-url' })
      )

      await flushPromises()
      expect(onError).toHaveBeenCalledWith(error)
      expect(result.doc.value).toBeNull()
      app.unmount()
    })

    it('should set doc to null on failure', async () => {
      const mockDoc = createMockDoc()
      mockGetDocument.mockReturnValueOnce(createMockLoadingTask(mockDoc))
      const source = ref('good-url')
      const onError = vi.fn()

      const { app, result } = withSetup(() =>
        useVuePdfEmbed({ onError, source })
      )

      await flushPromises()
      expect(result.doc.value).toBe(mockDoc)
      const error = new Error()
      mockGetDocument.mockReturnValueOnce({
        promise: Promise.reject(error),
        onPassword: null,
        onProgress: null,
        destroy: vi.fn(),
      })
      source.value = 'bad-url'
      await flushPromises()
      expect(result.doc.value).toBeNull()
      app.unmount()
    })
  })

  describe('password handling', () => {
    it('should set onPassword on loading task when provided', async () => {
      const mockTask = createMockLoadingTask(createMockDoc())
      mockGetDocument.mockReturnValue(mockTask)

      const { app } = withSetup(() =>
        useVuePdfEmbed({ onPasswordRequest: vi.fn(), source: 'test.pdf' })
      )

      await flushPromises()
      expect(mockTask.onPassword).not.toBeNull()
      app.unmount()
    })

    it('should pass isWrongPassword correctly based on PasswordResponses', async () => {
      const mockTask = createMockLoadingTask(createMockDoc())
      mockGetDocument.mockReturnValue(mockTask)
      const onPasswordRequest = vi.fn()

      const { app } = withSetup(() =>
        useVuePdfEmbed({ onPasswordRequest, source: 'test.pdf' })
      )

      await flushPromises()
      const callback = vi.fn()
      mockTask.onPassword!(callback, PasswordResponses.NEED_PASSWORD)
      expect(onPasswordRequest).toHaveBeenCalledWith({
        callback,
        isWrongPassword: false,
      })
      onPasswordRequest.mockClear()
      mockTask.onPassword!(callback, PasswordResponses.INCORRECT_PASSWORD)
      expect(onPasswordRequest).toHaveBeenCalledWith({
        callback,
        isWrongPassword: true,
      })
      app.unmount()
    })
  })

  describe('progress handling', () => {
    it('should set onProgress on loading task when provided', async () => {
      const mockTask = createMockLoadingTask(createMockDoc())
      mockGetDocument.mockReturnValue(mockTask)
      const onProgress = vi.fn()

      const { app } = withSetup(() =>
        useVuePdfEmbed({ onProgress, source: 'test.pdf' })
      )

      await flushPromises()
      expect(mockTask.onProgress).toBe(onProgress)
      app.unmount()
    })
  })

  describe('download', () => {
    it('should do nothing when doc is null', async () => {
      const { app, result } = withSetup(() => useVuePdfEmbed({ source: null }))

      await flushPromises()
      await result.download('file.pdf')
      expect(downloadPdf).not.toHaveBeenCalled()
      app.unmount()
    })

    it('should call downloadPdf with document data and filename', async () => {
      const mockDoc = createMockDoc()
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))

      const { app, result } = withSetup(() =>
        useVuePdfEmbed({ source: 'test.pdf' })
      )

      await flushPromises()
      await result.download('file.pdf')
      expect(mockDoc.getData).toHaveBeenCalled()
      expect(mockDoc.saveDocument).not.toHaveBeenCalled()
      expect(downloadPdf).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'file.pdf'
      )
      app.unmount()
    })

    it('should call saveDocument when form values are present', async () => {
      const mockDoc = createMockDoc(3, { annotationStorage: { size: 1 } })
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))

      const { app, result } = withSetup(() =>
        useVuePdfEmbed({ source: 'test.pdf' })
      )

      await flushPromises()
      await result.download('file.pdf')
      expect(mockDoc.saveDocument).toHaveBeenCalled()
      expect(mockDoc.getData).not.toHaveBeenCalled()
      expect(downloadPdf).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'file.pdf'
      )
      app.unmount()
    })
  })

  describe('print', () => {
    it('should do nothing when doc is null', async () => {
      const { app, result } = withSetup(() => useVuePdfEmbed({ source: null }))

      await flushPromises()
      await result.print()
      expect(createPrintIframe).not.toHaveBeenCalled()
      app.unmount()
    })

    it('should create an iframe and render pages', async () => {
      const mockDoc = createMockDoc(2)
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))

      const { app, result } = withSetup(() =>
        useVuePdfEmbed({ source: 'test.pdf' })
      )

      await flushPromises()
      await result.print()
      expect(createPrintIframe).toHaveBeenCalled()
      expect(mockDoc.getPage).toHaveBeenCalledWith(1)
      expect(mockDoc.getPage).toHaveBeenCalledWith(2)
      app.unmount()
    })

    it('should print only specified pages when pageNumber is given', async () => {
      const mockDoc = createMockDoc(3)
      mockGetDocument.mockReturnValue(createMockLoadingTask(mockDoc))

      const { app, result } = withSetup(() =>
        useVuePdfEmbed({ source: 'test.pdf' })
      )

      await flushPromises()
      await result.print(undefined, undefined, [1, 3])
      expect(mockDoc.getPage).toHaveBeenCalledWith(1)
      expect(mockDoc.getPage).not.toHaveBeenCalledWith(2)
      expect(mockDoc.getPage).toHaveBeenCalledWith(3)
      app.unmount()
    })
  })

  describe('cleanup on unmount', () => {
    it('should destroy doc and loading task on unmount', async () => {
      const mockDoc = createMockDoc()
      const mockTask = createMockLoadingTask(mockDoc)
      mockGetDocument.mockReturnValue(mockTask)

      const { app } = withSetup(() => useVuePdfEmbed({ source: 'test.pdf' }))

      await flushPromises()
      app.unmount()
      expect(mockTask.destroy).toHaveBeenCalled()
      expect(mockDoc.destroy).toHaveBeenCalled()
    })

    it('should not destroy externally-provided doc', async () => {
      const mockDoc = createMockDoc()
      const source = shallowRef(mockDoc as unknown as PDFDocumentProxy)

      const { app } = withSetup(() => useVuePdfEmbed({ source }))

      await flushPromises()
      app.unmount()
      expect(mockDoc.destroy).not.toHaveBeenCalled()
    })
  })
})
