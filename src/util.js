export function addPrintStyles(iframe, sizeX, sizeY) {
  const style = iframe.contentWindow.document.createElement('style')
  style.textContent = `
    @page {
      margin: 0;
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
  iframe.contentWindow.document.head.appendChild(style)
  iframe.contentWindow.document.body.style.width = '100%'
}

export function createPrintIframe(container) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.width = 0
    iframe.height = 0
    iframe.style.position = 'absolute'
    iframe.style.top = 0
    iframe.style.left = 0
    iframe.style.border = 'none'
    iframe.style.overflow = 'hidden'
    iframe.onload = () => resolve(iframe)
    container.appendChild(iframe)
  })
}

export function emptyElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild)
  }
}

export function releaseChildCanvases(el) {
  el.querySelectorAll('canvas').forEach((canvas) => {
    canvas.width = 1
    canvas.height = 1
    canvas.getContext('2d')?.clearRect(0, 0, 1, 1)
  })
}
