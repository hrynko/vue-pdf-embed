import type { PDFDocumentProxy } from 'pdfjs-dist'

// @internal
export function addPrintStyles(
  iframe: HTMLIFrameElement,
  sizeX: number,
  sizeY: number
) {
  const style = iframe.contentWindow!.document.createElement('style')
  style.textContent = `
    @page {
      margin: 3mm;
      size: ${sizeX}pt ${sizeY}pt;
    }
    body {
      margin: 0;
    }
    canvas {
      width: 100%;
      page-break-after: always;
      page-break-before: avoid;
      page-break-inside: avoid;
    }
  `
  iframe.contentWindow!.document.head.appendChild(style)
  iframe.contentWindow!.document.body.style.width = '100%'
}

// @internal
export function createPrintIframe(
  container: HTMLDivElement
): Promise<HTMLIFrameElement> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.width = '0'
    iframe.height = '0'
    iframe.style.position = 'absolute'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.border = 'none'
    iframe.style.overflow = 'hidden'
    iframe.onload = () => resolve(iframe)
    container.appendChild(iframe)
  })
}

// @internal
export function downloadPdf(data: Uint8Array, filename: string) {
  const url = URL.createObjectURL(
    new Blob([data], {
      type: 'application/pdf',
    })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(anchor)
  }, 1000)
}

// @internal
export function emptyElement(el?: HTMLElement | null) {
  while (el?.firstChild) {
    el.removeChild(el.firstChild)
  }
}

// @internal
export function isDocument(doc: unknown): doc is PDFDocumentProxy {
  return doc ? Object.prototype.hasOwnProperty.call(doc, '_pdfInfo') : false
}

// @internal
export function releaseChildCanvases(el?: HTMLElement | null) {
  el?.querySelectorAll('canvas').forEach((canvas: HTMLCanvasElement) => {
    canvas.width = 1
    canvas.height = 1
    canvas.getContext('2d')?.clearRect(0, 0, 1, 1)
  })
}
