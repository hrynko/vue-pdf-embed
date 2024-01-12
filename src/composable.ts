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
import {
  PasswordResponses,
  type OnProgressParameters,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist'

import type { PasswordRequestParams, Source } from './types'

export function useVuePdfEmbed({
  onError,
  onPasswordRequest,
  onProgress,
  source,
  workerSrc,
}: {
  onError?: (e: Error) => unknown
  onPasswordRequest?: (passwordRequestParams: PasswordRequestParams) => unknown
  onProgress?: (progressParams: OnProgressParameters) => unknown
  source: ComputedRef<Source> | MaybeRef<Source> | ShallowRef<Source>
  workerSrc?: string
}) {
  if (!pdf.GlobalWorkerOptions?.workerSrc) {
    pdf.GlobalWorkerOptions.workerSrc = PdfWorker
  }

  const doc = shallowRef<PDFDocumentProxy | null>(null)
  const docLoadingTask = shallowRef<PDFDocumentLoadingTask | null>(null)

  watchEffect(async () => {
    const sourceValue = toValue(source)

    if (!sourceValue) {
      return
    }

    if (Object.prototype.hasOwnProperty.call(sourceValue, '_pdfInfo')) {
      doc.value = sourceValue as PDFDocumentProxy
      return
    }

    try {
      if (workerSrc) {
        pdf.GlobalWorkerOptions.workerSrc = workerSrc
      }

      docLoadingTask.value = pdf.getDocument(
        sourceValue as Parameters<typeof pdf.getDocument>
      )

      if (onPasswordRequest) {
        docLoadingTask.value!.onPassword = (
          callback: Function,
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

  onBeforeUnmount(() => {
    if (docLoadingTask.value?.onPassword) {
      // @ts-expect-error: onPassword must be reset
      docLoadingTask.value.onPassword = null
    }
    if (docLoadingTask.value?.onProgress) {
      // @ts-expect-error: onProgress must be reset
      docLoadingTask.value.onProgress = null
    }
    doc.value?.destroy()
  })

  return {
    doc,
  }
}
