import {
  onBeforeUnmount,
  shallowRef,
  toValue,
  watch,
  watchEffect,
  type ComputedRef,
  type MaybeRef,
  type ShallowRef,
} from 'vue'
import {
  AnnotationMode,
  PasswordResponses,
  getDocument,
} from 'pdfjs-dist/legacy/build/pdf.mjs'
import type {
  OnProgressParameters,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
} from 'pdfjs-dist'

import type { PasswordRequestParams, Source } from './types'
import {
  addPrintStyles,
  createPrintIframe,
  downloadPdf,
  isDocument,
  releaseCanvas,
  releaseChildCanvases,
} from './utils'

export function useVuePdfEmbed({
  onError,
  onPasswordRequest,
  onProgress,
  source,
}: {
  onError?: (e: Error) => unknown
  onPasswordRequest?: (passwordRequestParams: PasswordRequestParams) => unknown
  onProgress?: (progressParams: OnProgressParameters) => unknown
  source: ComputedRef<Source> | MaybeRef<Source> | ShallowRef<Source>
}) {
  const doc = shallowRef<PDFDocumentProxy | null>(null)
  const docLoadingTask = shallowRef<PDFDocumentLoadingTask | null>(null)

  watchEffect(async () => {
    const sourceValue = toValue(source)

    if (!sourceValue) {
      return
    } else if (isDocument(sourceValue)) {
      doc.value = sourceValue
      return
    }

    try {
      docLoadingTask.value = getDocument(
        sourceValue as Parameters<typeof getDocument>[0]
      )

      if (onPasswordRequest) {
        docLoadingTask.value!.onPassword = (
          callback: (password: unknown) => void,
          response: number
        ) => {
          onPasswordRequest({
            callback,
            isWrongPassword: response === PasswordResponses.INCORRECT_PASSWORD,
          })
        }
      }

      if (onProgress) {
        docLoadingTask.value.onProgress = onProgress
      }

      doc.value = await docLoadingTask.value.promise
    } catch (e) {
      doc.value = null

      if (onError) {
        onError(e as Error)
      } else {
        throw e
      }
    }
  })

  watch(doc, (_, oldDoc) => {
    oldDoc?.destroy()
  })

  onBeforeUnmount(() => {
    if (docLoadingTask.value?.onPassword) {
      // @ts-expect-error: onPassword must be reset
      docLoadingTask.value.onPassword = null
    }
    if (docLoadingTask.value?.onProgress) {
      // @ts-expect-error: onProgress must be reset
      docLoadingTask.value.onProgress = null
    }
    docLoadingTask.value?.destroy()
    if (!isDocument(toValue(source))) {
      doc.value?.destroy()
    }
  })

  const download = async (filename: string) => {
    if (!doc.value) {
      return
    }

    const data = await doc.value.getData()
    const metadata = await doc.value.getMetadata()
    const suggestedFilename =
      // @ts-expect-error: contentDispositionFilename is not typed
      filename ?? metadata.contentDispositionFilename ?? ''
    downloadPdf(data, suggestedFilename)
  }

  const print = async (
    dpi = 300,
    filename = '',
    pageNumber?: number | number[]
  ) => {
    if (!doc.value) {
      return
    }

    const printUnits = dpi / 72
    const styleUnits = 96 / 72
    let container: HTMLDivElement
    let iframe: HTMLIFrameElement
    let title: string | undefined

    try {
      container = window.document.createElement('div')
      container.style.display = 'none'
      window.document.body.appendChild(container)
      iframe = await createPrintIframe(container)

      const batchSize = Math.max(3, Math.floor(10 * (300 / dpi)))
      const pageNums = pageNumber
        ? Array.isArray(pageNumber)
          ? pageNumber
          : [pageNumber]
        : [...Array(doc.value.numPages + 1).keys()].slice(1)

      for (
        let batchIndex = 0;
        batchIndex < pageNums.length;
        batchIndex += batchSize
      ) {
        await Promise.all(
          pageNums
            .slice(batchIndex, batchIndex + batchSize)
            .map(async (pageNum, i) => {
              const page = await doc.value!.getPage(pageNum)
              const viewport = page.getViewport({
                scale: 1,
                rotation: 0,
              })

              if (batchIndex + i === 0) {
                const sizeX = (viewport.width * printUnits) / styleUnits
                const sizeY = (viewport.height * printUnits) / styleUnits
                addPrintStyles(iframe, sizeX, sizeY)
              }

              const canvas = window.document.createElement('canvas')
              canvas.width = viewport.width * printUnits
              canvas.height = viewport.height * printUnits
              container.appendChild(canvas)
              const canvasClone = canvas.cloneNode() as HTMLCanvasElement
              iframe.contentWindow!.document.body.appendChild(canvasClone)

              await page.render({
                annotationMode: AnnotationMode.ENABLE_STORAGE,
                canvas,
                intent: 'print',
                transform: [printUnits, 0, 0, printUnits, 0, 0],
                viewport,
              }).promise

              canvasClone.getContext('2d')!.drawImage(canvas, 0, 0)
              releaseCanvas(canvas)
            })
        )
      }

      if (filename) {
        title = window.document.title
        window.document.title = filename
      }

      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      if (title) {
        window.document.title = title
      }

      releaseChildCanvases(iframe!.contentWindow?.document.body)
      releaseChildCanvases(container!)
      container!.parentNode?.removeChild(container!)
    }
  }

  return {
    doc,
    download,
    print,
  }
}
