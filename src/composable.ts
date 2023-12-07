import {
  onBeforeUnmount,
  shallowRef,
  toValue,
  watchEffect,
  type ComputedRef,
  type MaybeRef,
  type ShallowRef,
} from 'vue'
import * as pdf from 'pdfjs-dist/legacy/build/pdf'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min?url'
import type {
  GetDocumentParameters,
  OnProgressParameters,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
} from 'pdfjs-dist/types/src/display/api'

pdf.GlobalWorkerOptions.workerSrc = PdfWorker

export function useVuePdfEmbed({
  onError,
  onPasswordRequest,
  onProgress,
  source,
  workerSrc,
}: {
  onError?: (e: Error) => unknown
  onPasswordRequest?: (passwordRequestParams: {
    callback: Function
    isWrongPassword: boolean
  }) => unknown
  onProgress?: (progressParams: OnProgressParameters) => unknown
  source:
    | ComputedRef<GetDocumentParameters | PDFDocumentProxy>
    | MaybeRef<GetDocumentParameters | PDFDocumentProxy>
    | ShallowRef<GetDocumentParameters | PDFDocumentProxy>
  workerSrc?: string
}) {
  const document = shallowRef<PDFDocumentProxy | null>(null)
  const documentLoadingTask = shallowRef<PDFDocumentLoadingTask | null>(null)

  watchEffect(async () => {
    const sourceValue = toValue(source)

    if (Object.prototype.hasOwnProperty.call(sourceValue, '_pdfInfo')) {
      document.value = sourceValue as PDFDocumentProxy
      return
    }

    try {
      if (workerSrc) {
        pdf.GlobalWorkerOptions.workerSrc = workerSrc
      }
      documentLoadingTask.value = pdf.getDocument(
        sourceValue as GetDocumentParameters
      )

      if (onPasswordRequest) {
        documentLoadingTask.value.onPassword = (
          callback: Function,
          response: number
        ) => {
          onPasswordRequest({
            callback,
            isWrongPassword:
              response === pdf.PasswordResponses.INCORRECT_PASSWORD,
          })
        }
      }

      if (onProgress) {
        documentLoadingTask.value.onProgress = onProgress
      }

      document.value = await documentLoadingTask.value.promise
    } catch (e) {
      document.value = null

      if (onError) {
        onError(e as Error)
      } else {
        throw e
      }
    }
  })

  onBeforeUnmount(() => {
    if (documentLoadingTask.value?.onPassword) {
      // @ts-expect-error: onPassword must be reset
      documentLoadingTask.value.onPassword = null
    }
    if (documentLoadingTask.value?.onProgress) {
      // @ts-expect-error: onProgress must be reset
      documentLoadingTask.value.onProgress = null
    }
    document.value?.destroy()
  })

  return {
    document,
  }
}
