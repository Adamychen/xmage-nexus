import { useEffect, useRef, useState } from 'react'

const MIN_CARD_W = 48
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

      // Measure the status bar (InfoBar + Hand + ResourceBar) or fallback to 54px
      const statusRow = el.querySelector(
        '.bz-status-row, .pz-bottom-row, .oz-top-row, .oz-bottom-row'
      ) as HTMLElement | null
      const statusH = statusRow && statusRow.offsetHeight > 0 ? statusRow.offsetHeight : 54

      // Zone grid has 2 card rows (1fr each) + 1 status row (auto)
      // Gaps (4px * 2 = 8px) + Zone padding (3px * 2 = 6px) + Band padding (2px * 2 = 4px) = ~18px
      const verticalOverhead = statusH + 18
      const availH = rect.height - verticalOverhead
      if (availH <= 0) return

      const cardRows = 2
      const rowHeight = availH / cardRows
      const safeCardH = Math.max(32, rowHeight - 6)
      const fromHeight = safeCardH / CARD_ASPECT

      const w = Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, fromHeight))
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
