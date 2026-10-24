import { useLayoutEffect, useState } from 'react'

export const STACK_BASE_COLUMN_PX = 180

export function stackColumnWidth(available: number, gap: number, scale: number): number | null {
  if (!(available > 0) || !(scale > 0)) return null
  const count = Math.max(1, Math.floor((available + gap) / (STACK_BASE_COLUMN_PX + gap)))
  const base = Math.max(STACK_BASE_COLUMN_PX, (available - (count - 1) * gap) / count)
  return Math.floor(base * scale * 100) / 100
}

function px(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export function useStackColumnWidth(el: HTMLElement | null, scale: number, active: boolean): number | null {
  const [width, setWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!el || !active) {
      setWidth(null)
      return
    }
    const measure = () => {
      const style = getComputedStyle(el)
      const available = el.clientWidth - px(style.paddingLeft) - px(style.paddingRight)
      const board = el.querySelector('.arena-stack-board')
      const gap = board ? px(getComputedStyle(board).columnGap) : 0
      setWidth(stackColumnWidth(available, gap, scale))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [el, scale, active])

  return width
}
