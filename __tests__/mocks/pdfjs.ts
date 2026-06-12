import { vi } from 'vitest'

export const createMockPage = (overrides?: Record<string, unknown>) => ({
  view: [0, 0, 595, 842],
  rotate: 0,
  getAnnotations: vi.fn(() => Promise.resolve([])),
  getTextContent: vi.fn(() => Promise.resolve({ items: [] })),
  getViewport: vi.fn(({ scale = 1 } = {}) => ({
    width: 595 * scale,
    height: 842 * scale,
    scale,
    clone: vi.fn(
      ({ scale: newScale }: { scale?: number; dontFlip?: boolean } = {}) => ({
        width: 595 * (newScale ?? scale),
        height: 842 * (newScale ?? scale),
        scale: newScale ?? scale,
      })
    ),
  })),
  render: vi.fn(() => ({ promise: Promise.resolve() })),
  ...overrides,
})

export const createMockDoc = (
  numPages = 3,
  overrides?: Record<string, unknown>
) => {
  const pages = Array.from({ length: numPages }, () => createMockPage())
  return {
    _pdfInfo: {},
    annotationStorage: { size: 0 },
    getData: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    getMetadata: vi.fn(() =>
      Promise.resolve({ contentDispositionFilename: 'document.pdf' })
    ),
    getPage: vi.fn((num: number) => Promise.resolve(pages[num - 1])),
    saveDocument: vi.fn(() => Promise.resolve(new Uint8Array([4, 5, 6]))),
    destroy: vi.fn(),
    numPages,
    ...overrides,
  }
}

export const createMockLoadingTask = (
  doc: ReturnType<typeof createMockDoc>,
  overrides?: Record<string, unknown>
) => ({
  onPassword: null as
    | ((callback: (password: unknown) => void, response: number) => void)
    | null,
  onProgress: null as
    | ((params: { loaded: number; total: number }) => void)
    | null,
  destroy: vi.fn(),
  promise: Promise.resolve(doc),
  ...overrides,
})
