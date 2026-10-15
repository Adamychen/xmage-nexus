import { useEffect, type RefObject } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function setPointerVars(el: HTMLElement, px: string, py: string) {
  el.style.setProperty('--px', px)
  el.style.setProperty('--py', py)
}

/** Delegated version of `usePointerVars`: one pair of listeners on the container tracks whichever
 *  `selector` descendant is under the pointer, so tiles that mount and unmount (a booster, a
 *  pack) need no per-element hook. Sets `--px`/`--py` (0..1) on the hovered tile only. */
export function usePointerTilt<T extends HTMLElement>(ref: RefObject<T | null>, selector: string) {
  useEffect(() => {
    const root = ref.current
    if (!root || typeof window === 'undefined' || window.matchMedia?.(REDUCED_MOTION).matches) return
    let current: HTMLElement | null = null
    const release = () => {
      if (current) setPointerVars(current, '0.5', '0.5')
      current = null
    }
    const onMove = (e: PointerEvent) => {
      const hit = (e.target as Element | null)?.closest<HTMLElement>(selector) ?? null
      const el = hit && root.contains(hit) ? hit : null
      if (el !== current) release()
      if (!el) return
      current = el
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      setPointerVars(el, ((e.clientX - rect.left) / rect.width).toFixed(3), ((e.clientY - rect.top) / rect.height).toFixed(3))
    }
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', release)
    return () => {
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', release)
      release()
    }
  }, [ref, selector])
}
