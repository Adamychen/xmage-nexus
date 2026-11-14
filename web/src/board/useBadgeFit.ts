import { useLayoutEffect, useState, type RefObject } from 'react'
import { visibleBadges } from './badgeFit'

/**
 * How many badges a strip shows (BRD-52). A strip that runs along the card reads how many fit in
 * its width. A strip that runs down the card holds a fixed number per column and opens another
 * column for every further group of them, so the columns follow the count of badges and not the
 * height of the card: on a card too short for the full column the badges shrink to fit it, and the
 * card's width is what finally decides how many columns, and badges, there is room for.
 */
export function useBadgeFit(ref: RefObject<HTMLElement | null>, count: number): number {
  const [visible, setVisible] = useState(count)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null
      const style = getComputedStyle(el)
      const column = style.flexDirection.startsWith('column')
      if (!column) {
        const gap = parseFloat(style.columnGap) || 0
        setVisible(visibleBadges(count, el.clientWidth, first?.offsetWidth ?? 0, gap))
        return
      }
      const host = el.offsetParent as HTMLElement | null
      const gap = parseFloat(style.rowGap) || 0
      const rows = Math.max(1, Number(style.getPropertyValue('--badge-rows')) || 1)
      const base = parseFloat(style.getPropertyValue('--badge-size')) || first?.offsetHeight || 0
      const room = host ? host.clientHeight - (parseFloat(style.top) || 0) - (parseFloat(style.bottom) || 0) : el.clientHeight
      // The column holds its whole group of badges whatever the card's size, so a card too short
      // for them draws them smaller instead of breaking the group into another column.
      const size = base > 0 && room > 0 ? Math.max(8, Math.min(base, Math.floor((room - (rows - 1) * gap) / rows))) : base
      const fit = `${size}px`
      if (el.style.getPropertyValue('--kw-fit') !== fit) el.style.setProperty('--kw-fit', fit)
      const across = host ? host.clientWidth - (parseFloat(style.right) || 0) * 2 : el.clientWidth
      const lanes = Math.max(1, Math.floor((across + gap) / (size + gap)))
      setVisible(visibleBadges(count, rows * size + (rows - 1) * gap, size, gap, lanes))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    const host = el.offsetParent
    if (host) observer.observe(host)
    return () => observer.disconnect()
  }, [ref, count])

  return Math.min(visible, count)
}
