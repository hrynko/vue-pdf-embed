import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

type DocumentInitParameters = NonNullable<Parameters<typeof getDocument>[0]>

export type Source =
  | DocumentInitParameters
  | NonNullable<DocumentInitParameters['data']>
  | NonNullable<DocumentInitParameters['url']>
  | PDFDocumentProxy
  | null

export type PasswordRequestParams = {
  callback: (password: unknown) => void
  isWrongPassword: boolean
}
