import { useEffect, useRef, useState } from 'react'

const MIN_CARD_W = 44
const MAX_CARD_W = 130
const CARD_ASPECT = 1.4

interface ZoneScale {
  cardW: number
  ref: React.RefObject<HTMLDivElement | null>
}

export function useZoneScale(): ZoneScale {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cardW, setCardW] = useState(80)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0 || rect.width <= 0) return

      // Measure the status bar (InfoBar + Hand + ResourceBar) or fallback to 44px
      const statusRow = el.querySelector(
        '.bz-status-row, .pz-bottom-row, .oz-top-row, .oz-bottom-row'
      ) as HTMLElement | null
      const statusH = statusRow && statusRow.offsetHeight > 0 ? statusRow.offsetHeight : 44

      // Zone grid has 2 card rows (1fr each) + 1 status row (auto)
      const verticalOverhead = statusH + 12
      const availH = rect.height - verticalOverhead
      if (availH <= 0) {
        setCardW(MIN_CARD_W)
        return
      }

      const cardRows = 2
      const rowHeight = availH / cardRows
      const safeCardH = Math.max(28, rowHeight - 4)
      const fromHeight = safeCardH / CARD_ASPECT

      const w = Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, fromHeight))
      setCardW(Math.round(w))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    let rafId: number | null = null
    const debouncedMeasure = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        measure()
      })
    }
    const ro = new ResizeObserver(debouncedMeasure)
    ro.observe(el)
    const mo = new MutationObserver(debouncedMeasure)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  return { cardW, ref }
}
