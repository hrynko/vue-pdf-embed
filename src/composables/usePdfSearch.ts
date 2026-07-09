import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import {
  EventBus,
  PDFFindController,
  type PDFLinkService,
} from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'

type SearchOptions = {
  caseSensitive?: boolean
  entireWord?: boolean
  highlightAll?: boolean
  matchDiacritics?: boolean
}

export function usePdfSearch(doc: MaybeRefOrGetter<PDFDocumentProxy | null>) {
  const currentMatch = ref(0)
  const currentMatchPage = ref(1)
  const defaultOptions: Required<SearchOptions> = {
    caseSensitive: false,
    entireWord: false,
    matchDiacritics: false,
    highlightAll: true,
  }
  const eventBus = new EventBus()
  const matchCount = ref(0)
  const query = ref('')
  let activeOptions: Required<SearchOptions> = { ...defaultOptions }

  const findController = new PDFFindController({
    eventBus,
    linkService: {
      get page() {
        return currentMatchPage.value
      },
      set page(value: number) {
        currentMatchPage.value = value
      },
      get pagesCount() {
        return toValue(doc)?.numPages ?? 0
      },
    } as PDFLinkService,
  })

  const dispatch = (type: string, findPrevious = false) => {
    eventBus.dispatch('find', {
      type,
      query: query.value,
      findPrevious,
      ...activeOptions,
    })
  }

  const find = (newQuery: string, options: SearchOptions = {}) => {
    query.value = newQuery
    activeOptions = { ...defaultOptions, ...options }
    dispatch('')
  }

  const clear = () => {
    query.value = ''
    activeOptions = { ...defaultOptions }
    currentMatchPage.value = 1
    currentMatch.value = 0
    matchCount.value = 0
    dispatch('')
  }

  watch(
    () => toValue(doc),
    (newDoc) => {
      if (newDoc) {
        clear()
        findController.setDocument(newDoc)
      }
    },
    { immediate: true }
  )

  const handleMatchUpdate = ({
    matchesCount,
  }: {
    matchesCount?: { current: number; total: number }
  }) => {
    matchCount.value = matchesCount?.total ?? 0
    currentMatch.value = matchesCount?.current ?? 0
  }

  eventBus.on('updatefindmatchescount', handleMatchUpdate)
  eventBus.on('updatefindcontrolstate', handleMatchUpdate)

  return {
    clear,
    currentMatch,
    currentMatchPage,
    find,
    findController,
    matchCount,
    next: () => dispatch('again', false),
    previous: () => dispatch('again', true),
  }
}
