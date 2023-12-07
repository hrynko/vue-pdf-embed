import type {
  GetDocumentParameters,
  PDFDocumentProxy,
} from 'pdfjs-dist/types/src/display/api'

export type Source = GetDocumentParameters | PDFDocumentProxy

export type PasswordRequestParams = {
  callback: Function
  isWrongPassword: boolean
}
