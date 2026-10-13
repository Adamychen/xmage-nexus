import { useLayoutEffect, type RefObject } from 'react'

export const FIT_MIN = 0.5
const FIT_STEP = 0.04

export function fitScale(contentHeight: number, boxHeight: number): number {
  if (boxHeight <= 0 || contentHeight <= 0 || contentHeight <= boxHeight) return 1
  const ratio = Math.sqrt(boxHeight / contentHeight)
  const stepped = Math.floor(ratio / FIT_STEP) * FIT_STEP
  return Math.max(FIT_MIN, Math.min(1, stepped))
}

export function useTextFit(ref: RefObject<HTMLElement | null>, deps: readonly unknown[]): void {
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const apply = () => {
      box.style.setProperty('--rc-fit', '1')
      let scale = fitScale(box.scrollHeight, box.clientHeight)
      box.style.setProperty('--rc-fit', String(scale))
      for (let i = 0; i < 6 && scale > FIT_MIN && box.scrollHeight > box.clientHeight + 1; i++) {
        scale = Math.max(FIT_MIN, scale - FIT_STEP)
        box.style.setProperty('--rc-fit', String(scale))
      }
    }
    apply()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(apply)
    observer.observe(box)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
