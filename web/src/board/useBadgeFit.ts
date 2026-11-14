import { useLayoutEffect, useState, type RefObject } from 'react'
import { visibleBadges } from './badgeFit'

export function useBadgeFit(ref: RefObject<HTMLElement | null>, count: number): number {
  const [visible, setVisible] = useState(count)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null
      const style = getComputedStyle(el)
      const column = style.flexDirection.startsWith('column')
      const gap = parseFloat(column ? style.rowGap : style.columnGap) || 0
      const room = column ? el.clientHeight : el.clientWidth
      const size = (column ? first?.offsetHeight : first?.offsetWidth) ?? 0
      setVisible(visibleBadges(count, room, size, gap))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, count])

  return Math.min(visible, count)
}
