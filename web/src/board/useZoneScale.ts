import { useEffect, useRef, useState } from 'react'

const MIN_CARD_W = 52
const MAX_CARD_W = 130
const CARD_ASPECT = 1.4

interface ZoneScale {
  cardW: number
  ref: React.RefObject<HTMLDivElement | null>
}

export function useZoneScale(): ZoneScale {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cardW, setCardW] = useState(86)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0 || rect.width <= 0) return

      const isOpponent = el.classList.contains('opponent-zone')
      const rowGap = 4
      const fixedRowH = isOpponent ? 0 : 56
      const cardRows = 2
      const availH = rect.height - fixedRowH - rowGap * (cardRows + 1)
      const fromHeight = availH / cardRows / CARD_ASPECT

      const bandPadding = 16
      const availW = rect.width - bandPadding * 2

      const row1Selector = isOpponent ? '.oz-permanents-row .card-slot' : '.pz-creatures-row .card-slot'
      const row2Selector = isOpponent ? '.oz-creatures-row .card-slot' : '.pz-permanents-row .card-slot'
      const row1Cards = el.querySelectorAll(row1Selector).length || 1
      const row2Cards = el.querySelectorAll(row2Selector).length || 1
      const maxInRow = Math.max(row1Cards, row2Cards)
      const cardGap = 10
      const fromWidth = (availW - cardGap * (maxInRow - 1)) / maxInRow

      const w = Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, Math.min(fromHeight, fromWidth)))
      setCardW(Math.round(w))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  return { cardW, ref }
}
