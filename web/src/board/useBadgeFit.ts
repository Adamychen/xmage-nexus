import { useLayoutEffect, useState, type RefObject } from 'react'
import { visibleBadges } from './badgeFit'

export function useBadgeFit(ref: RefObject<HTMLElement | null>, count: number): number {
  const [visible, setVisible] = useState(count)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0
      setVisible(visibleBadges(count, el.clientWidth, first?.offsetWidth ?? 0, gap))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, count])

  return Math.min(visible, count)
}
