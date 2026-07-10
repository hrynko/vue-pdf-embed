import type { PDFFindController } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'

type MatchPosition = { divIndex: number; offset: number }
type Match = { begin: MatchPosition; end: MatchPosition }

// @internal
export class TextHighlighter {
  private abortController: AbortController | null = null
  private enabled = false
  private findController: PDFFindController
  private matches: Match[] = []
  private matchScrolling: boolean
  private pageIndex: number
  private textContentItemsStr: string[] = []
  private textDivs: HTMLElement[] = []

  constructor({
    findController,
    matchScrolling,
    pageIndex,
  }: {
    findController: PDFFindController
    matchScrolling: boolean
    pageIndex: number
  }) {
    this.findController = findController
    this.matchScrolling = matchScrolling
    this.pageIndex = pageIndex
  }

  setTextMapping(divs: HTMLElement[], texts: string[]) {
    this.textDivs = divs
    this.textContentItemsStr = texts
  }

  enable() {
    if (this.enabled) {
      return
    }

    this.enabled = true

    if (!this.abortController) {
      this.abortController = new AbortController()
      this.findController._eventBus.on(
        'updatetextlayermatches',
        (event: { pageIndex: number }) => {
          if (event.pageIndex === this.pageIndex || event.pageIndex === -1) {
            this.updateMatches()
          }
        },
        { signal: this.abortController.signal }
      )
    }

    this.updateMatches()
  }

  disable() {
    if (!this.enabled) {
      return
    }

    this.enabled = false
    this.abortController?.abort()
    this.abortController = null
    this.updateMatches(true)
  }

  private convertMatches(
    matchOffsets: number[] | null,
    matchLengths: number[] | null
  ): Match[] {
    if (!matchOffsets || !matchLengths) {
      return []
    }

    const lastDivIndex = this.textContentItemsStr.length - 1
    const result: Match[] = []

    let divIndex = 0
    let divStartOffset = 0

    matchOffsets.forEach((matchStart, i) => {
      let charOffset = matchStart
      while (
        divIndex !== lastDivIndex &&
        charOffset >= divStartOffset + this.textContentItemsStr[divIndex].length
      ) {
        divStartOffset += this.textContentItemsStr[divIndex].length
        divIndex++
      }
      const begin = { divIndex, offset: charOffset - divStartOffset }
      charOffset += matchLengths[i]
      while (
        divIndex !== lastDivIndex &&
        charOffset > divStartOffset + this.textContentItemsStr[divIndex].length
      ) {
        divStartOffset += this.textContentItemsStr[divIndex].length
        divIndex++
      }
      const end = { divIndex, offset: charOffset - divStartOffset }
      result.push({ begin, end })
    })

    return result
  }

  private appendTextToDiv(
    divIndex: number,
    fromOffset: number,
    toOffset: number | undefined,
    className?: string
  ): HTMLElement | null {
    let div = this.textDivs[divIndex]
    if (div.nodeType === Node.TEXT_NODE) {
      const span = document.createElement('span')
      div.before(span)
      span.append(div)
      this.textDivs[divIndex] = span
      div = span
    }

    const content = this.textContentItemsStr[divIndex].substring(
      fromOffset,
      toOffset
    )
    const node = document.createTextNode(content)

    if (className) {
      const span = document.createElement('span')
      span.className = `${className} appended`
      span.append(node)
      div.append(span)
      return className.includes('selected') ? span : null
    }

    div.append(node)
    return null
  }

  private renderMatches(matches: Match[]) {
    if (matches.length === 0) {
      return
    }

    const isSelectedPage =
      this.pageIndex === this.findController.selected?.pageIdx
    const selectedMatchIndex = this.findController.selected?.matchIdx ?? 0
    const highlightAll = (
      this.findController.state as { highlightAll?: boolean } | null
    )?.highlightAll
    if (!highlightAll && !isSelectedPage) {
      return
    }

    const startIndex = highlightAll ? 0 : selectedMatchIndex
    const stopIndex = highlightAll ? matches.length : selectedMatchIndex + 1

    const beginText = (begin: MatchPosition, className?: string) => {
      this.textDivs[begin.divIndex].textContent = ''
      return this.appendTextToDiv(begin.divIndex, 0, begin.offset, className)
    }

    let prevEnd: MatchPosition | null = null
    let lastDivIndex = -1
    let lastOffset = -1

    for (let matchIndex = startIndex; matchIndex < stopIndex; matchIndex++) {
      const { begin, end } = matches[matchIndex]
      if (begin.divIndex === lastDivIndex && begin.offset === lastOffset) {
        continue
      }
      lastDivIndex = begin.divIndex
      lastOffset = begin.offset

      const isSelected = isSelectedPage && matchIndex === selectedMatchIndex
      const highlightSuffix = isSelected ? ' selected' : ''
      let selectedSpan: HTMLElement | null = null

      if (!prevEnd || begin.divIndex !== prevEnd.divIndex) {
        if (prevEnd !== null) {
          this.appendTextToDiv(prevEnd.divIndex, prevEnd.offset, undefined)
        }
        beginText(begin)
      } else {
        this.appendTextToDiv(prevEnd.divIndex, prevEnd.offset, begin.offset)
      }

      if (begin.divIndex === end.divIndex) {
        selectedSpan = this.appendTextToDiv(
          begin.divIndex,
          begin.offset,
          end.offset,
          'highlight' + highlightSuffix
        )
      } else {
        selectedSpan = this.appendTextToDiv(
          begin.divIndex,
          begin.offset,
          undefined,
          'highlight begin' + highlightSuffix
        )
        this.textDivs.slice(begin.divIndex + 1, end.divIndex).forEach((div) => {
          div.className = 'highlight middle' + highlightSuffix
        })
        beginText(end, 'highlight end' + highlightSuffix)
      }
      prevEnd = end

      if (isSelected && this.matchScrolling) {
        this.findController.scrollMatchIntoView({
          element: selectedSpan!,
          pageIndex: this.pageIndex,
          matchIndex: selectedMatchIndex,
        })
      }
    }

    if (prevEnd) {
      this.appendTextToDiv(prevEnd.divIndex, prevEnd.offset, undefined)
    }
  }

  private updateMatches(reset = false) {
    if (!this.enabled && !reset) {
      return
    }

    let clearedUntilDivIndex = -1
    this.matches.forEach((match) => {
      const startDivIndex = Math.max(clearedUntilDivIndex, match.begin.divIndex)
      this.textDivs
        .slice(startDivIndex, match.end.divIndex + 1)
        .forEach((div, offset) => {
          div.textContent = this.textContentItemsStr[startDivIndex + offset]
          div.className = ''
        })
      clearedUntilDivIndex = match.end.divIndex + 1
    })

    if (!this.findController.highlightMatches || reset) {
      return
    }

    const pageMatches =
      this.findController.pageMatches?.[this.pageIndex] ?? null
    const pageMatchesLength =
      this.findController.pageMatchesLength?.[this.pageIndex] ?? null
    this.matches = this.convertMatches(pageMatches, pageMatchesLength)
    this.renderMatches(this.matches)
  }
}
