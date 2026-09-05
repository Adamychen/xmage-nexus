import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_CARD_W = 44
const MAX_CARD_W = 145
const MAX_PLAYER_CARD_W = 175
const CARD_ASPECT = 1.4

interface ZoneScale {
  cardW: number
  ref: React.RefCallback<HTMLDivElement> & React.RefObject<HTMLDivElement | null>
}

export function useZoneScale(): ZoneScale {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [cardW, setCardW] = useState(120)

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node
    setEl(node)
  }, []) as React.RefCallback<HTMLDivElement> & React.RefObject<HTMLDivElement | null>
  refCallback.current = nodeRef.current

  useEffect(() => {
    if (!el) return

    let rafId: number | null = null

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0 || rect.width <= 0) {
        // Element not yet laid out by browser — re-check on next animation frame
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null
            measure()
          })
        }
        return
      }

      // Measure the status bar (InfoBar + Hand + ResourceBar) or fallback based on mode
      const statusRow = el.querySelector(
        '.bz-status-row, .pz-bottom-row, .oz-top-row, .oz-bottom-row'
      ) as HTMLElement | null
      const isCompactPod = el.classList.contains('compact-pod')
      const defaultStatusH = isCompactPod ? 32 : 44
      const statusH = statusRow && statusRow.offsetHeight > 0 ? statusRow.offsetHeight : defaultStatusH

      // Zone grid always has 2 card rows (1fr each) + 1 status row (auto).
      // Bands never collapse (compact-pod included: static division), so cards
      // are always sized for 2 rows — playing the first land/creature no
      // longer re-scales the whole zone. (zone-empty hides both bands but
      // renders no cards, so the row count is irrelevant there.)
      const cardRows = 2

      const verticalOverhead = statusH + (isCompactPod ? 6 : 12)
      const availH = rect.height - verticalOverhead
      if (availH <= 0) {
        setCardW(MIN_CARD_W)
        return
      }

      const rowHeight = availH / cardRows
      const safeCardH = Math.max(28, rowHeight - (isCompactPod ? 2 : 4))
      const fromHeight = safeCardH / CARD_ASPECT

      const isPlayerZone = el.classList.contains('player-zone')
      const maxW = isPlayerZone ? MAX_PLAYER_CARD_W : MAX_CARD_W

      const w = Math.max(MIN_CARD_W, Math.min(maxW, fromHeight))
      setCardW(Math.round(w))
    }

    measure()

    const debouncedMeasure = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        measure()
      })
    }

    window.addEventListener('resize', debouncedMeasure)

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(debouncedMeasure)
      ro.observe(el)
    }

    let mo: MutationObserver | null = null
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(debouncedMeasure)
      mo.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      })
    }

    return () => {
      window.removeEventListener('resize', debouncedMeasure)
      if (rafId !== null) cancelAnimationFrame(rafId)
      ro?.disconnect()
      mo?.disconnect()
    }
  }, [el])

  return { cardW, ref: refCallback }
}
