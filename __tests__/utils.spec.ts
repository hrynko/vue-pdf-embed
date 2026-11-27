import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addPrintStyles,
  createPrintIframe,
  downloadPdf,
  emptyElement,
  getPrintRotation,
  isDocument,
  releaseCanvas,
  releaseChildCanvases,
} from '../src/internal/utils'

describe('addPrintStyles', () => {
  let iframe: HTMLIFrameElement

  beforeEach(() => {
    iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
  })

  afterEach(() => {
    iframe.remove()
  })

  it('should append a style element with page size', () => {
    addPrintStyles(iframe, 595, 842)
    const style = iframe.contentWindow!.document.head.querySelector('style')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('595pt 842pt')
  })

  it('should set body width to 100%', () => {
    addPrintStyles(iframe, 595, 842)
    expect(iframe.contentWindow!.document.body.style.width).toBe('100%')
  })

  it('should fit pages inside the sheet in both dimensions', () => {
    addPrintStyles(iframe, 595, 842)
    const style = iframe.contentWindow!.document.head.querySelector('style')
    expect(style!.textContent).toContain('max-width: 100%')
    expect(style!.textContent).toContain('max-height: calc(842pt - 6mm)')
  })
})

describe('getPrintRotation', () => {
  const createPage = (width: number, height: number, rotate = 0) =>
    ({
      rotate,
      getViewport: ({ rotation = rotate }: { rotation?: number } = {}) =>
        rotation % 180 === 0
          ? { width, height }
          : { width: height, height: width },
    }) as unknown as Parameters<typeof getPrintRotation>[0]

  it('should keep the page rotation when orientation matches the first page', () => {
    expect(getPrintRotation(createPage(595, 842), true)).toBe(0)
    expect(getPrintRotation(createPage(842, 595), false)).toBe(0)
  })

  it('should rotate pages whose orientation differs from the first page', () => {
    expect(getPrintRotation(createPage(842, 595), true)).toBe(90)
    expect(getPrintRotation(createPage(595, 842), false)).toBe(90)
  })

  it("should respect the page's own /Rotate", () => {
    // Landscape page stored as portrait with /Rotate 90
    expect(getPrintRotation(createPage(595, 842, 90), true)).toBe(180)
    expect(getPrintRotation(createPage(595, 842, 90), false)).toBe(90)
    expect(getPrintRotation(createPage(595, 842, 270), true)).toBe(0)
  })
})

describe('createPrintIframe', () => {
  it('should create a hidden iframe appended to the container', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const promise = createPrintIframe(container)
    const iframe = container.querySelector('iframe')!
    expect(iframe).not.toBeNull()
    expect(iframe.style.position).toBe('absolute')
    expect(iframe.width).toBe('0')
    expect(iframe.height).toBe('0')

    iframe.dispatchEvent(new Event('load'))
    const resolved = await promise
    expect(resolved).toBe(iframe)

    container.remove()
  })
})

describe('downloadPdf', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should create an anchor with a blob URL and trigger a click', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    downloadPdf(new Uint8Array([1, 2, 3]), 'test.pdf')

    const anchor = document.body.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor!.download).toBe('test.pdf')
    expect(anchor!.href).toContain('blob:')
    expect(clickSpy).toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    clickSpy.mockRestore()
  })

  it('should revoke the URL and remove the anchor', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')

    downloadPdf(new Uint8Array([1, 2, 3]), 'test.pdf')
    expect(document.body.querySelector('a')).not.toBeNull()

    vi.advanceTimersByTime(1000)
    expect(revokeSpy).toHaveBeenCalled()
    expect(document.body.querySelector('a')).toBeNull()

    revokeSpy.mockRestore()
  })
})

describe('emptyElement', () => {
  it('should remove all child nodes from an element', () => {
    const el = document.createElement('div')
    expect(el.childNodes.length).toBe(0)

    el.appendChild(document.createElement('span'))
    el.appendChild(document.createElement('span'))

    emptyElement(el)
    expect(el.childNodes.length).toBe(0)
  })
})

describe('isDocument', () => {
  it('should return true for an object with _pdfInfo property', () => {
    expect(isDocument({ _pdfInfo: {} })).toBe(true)
  })

  it('should return false for non-document values', () => {
    expect(isDocument({})).toBe(false)
    expect(isDocument('foo')).toBe(false)
    expect(isDocument(null)).toBe(false)
    expect(isDocument(undefined)).toBe(false)
  })
})

describe('releaseCanvas', () => {
  it('should set canvas dimensions to 1x1', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 200

    releaseCanvas(canvas)
    expect(canvas.width).toBe(1)
    expect(canvas.height).toBe(1)
  })

  it('should erase pixels', () => {
    const clearRect = vi.fn()
    const canvas = document.createElement('canvas')
    canvas.getContext = vi.fn(() => ({
      clearRect,
    })) as unknown as typeof canvas.getContext

    releaseCanvas(canvas)
    expect(clearRect).toHaveBeenCalledWith(0, 0, 1, 1)
  })
})

describe('releaseChildCanvases', () => {
  it('should release all descendant canvases', () => {
    const container = document.createElement('div')
    const canvas1 = document.createElement('canvas')
    canvas1.width = 100
    canvas1.height = 100
    container.appendChild(canvas1)
    const canvas2 = document.createElement('canvas')
    canvas2.width = 200
    canvas2.height = 200
    container.appendChild(canvas2)

    releaseChildCanvases(container)
    expect(canvas1.width).toBe(1)
    expect(canvas1.height).toBe(1)
    expect(canvas2.width).toBe(1)
    expect(canvas2.height).toBe(1)
  })
})
