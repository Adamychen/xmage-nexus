import { useEffect, useRef, useState } from 'react'
import { fxMotionDuration } from '../board/fx'

/** Tweens a number (life, counters) with rAF and cubic easing. Respects the effects settings: when `fxMotionDuration` returns 0 (fx-off or reduced motion) it jumps straight to the final value. */
export function useTweenNumber(value: number, durationMs = 350): number {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return

    const duration = fxMotionDuration(durationMs)
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
