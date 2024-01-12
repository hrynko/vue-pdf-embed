import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

export type Source = Parameters<typeof getDocument> | PDFDocumentProxy | null

export type PasswordRequestParams = {
  callback: Function
  isWrongPassword: boolean
}
