import { useEffect, useRef, useState } from 'react'
import { fxDuration } from '../board/fx'

/** Anima el cambio de un número (vida, contadores) con rAF y easing
 *  cúbico. Respeta los ajustes de efectos: si `fxDuration` devuelve 0
 *  (fx-off o reduced-motion) salta directo al valor final. */
export function useTweenNumber(value: number, durationMs = 350): number {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return

    const duration = fxDuration(durationMs)
    if (!duration) {
      displayRef.current = value
      setDisplay(value)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = Math.round(from + (value - from) * eased)
      displayRef.current = v
      setDisplay(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return display
}
