import { useEffect, useState } from 'react'

export function useMeasuredWidth(el: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width)
      setWidth((prev) => (prev === next ? prev : next))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return width
}
