import { useEffect, type RefObject } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export function usePointerVars<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined' || window.matchMedia?.(REDUCED_MOTION).matches) return
    const reset = () => {
      el.style.setProperty('--px', '0.5')
      el.style.setProperty('--py', '0.5')
    }
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--px', ((e.clientX - rect.left) / rect.width).toFixed(3))
      el.style.setProperty('--py', ((e.clientY - rect.top) / rect.height).toFixed(3))
    }
    reset()
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', reset)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', reset)
    }
  }, [ref])
}
