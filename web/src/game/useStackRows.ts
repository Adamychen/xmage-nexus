import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * BRD-54: how many chips a stack beside the player chip can hold in a column. The chip's own
 * height is the budget, measured rather than assumed, so a stack that runs out of room opens
 * another column instead of making the chip taller.
 */
export function useStackRows(ref: RefObject<HTMLElement | null>, count: number): number {
  const [rows, setRows] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null
      const host = el.parentElement
      if (!first || !host) return
      const item = first.offsetHeight
      if (item <= 0) return
      const gap = parseFloat(getComputedStyle(el).rowGap) || 0
      // The budget is what the rest of the chip is tall, never the chip itself: the stack is part
      // of the chip, so measuring the chip would grow with the stack and never settle.
      let room = 0
      for (const sibling of host.children) {
        if (sibling === el) continue
        room = Math.max(room, (sibling as HTMLElement).offsetHeight)
      }
      if (room <= 0) return
      setRows(Math.max(1, Math.min(count, Math.floor((room + gap) / (item + gap)))))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    const host = el.parentElement
    if (host) observer.observe(host)
    return () => observer.disconnect()
  }, [ref, count])

  return rows
}
