import { useEffect, useRef, useState } from 'react'

const FLASH_MS = 2200

export interface CountFlashState {
  delta: number
  key: number
}

/** Announces a change of a zone's card count ("+2", "-1") for a moment, so an event that moves
 *  cards (draw, discard, mill, exile, a revealed hand) shows up where the player already looks.
 *  The first value seen is the baseline and never flashes. */
export function useCountFlash(count: number): CountFlashState | null {
  const previous = useRef<number | null>(null)
  const serial = useRef(0)
  const [flash, setFlash] = useState<CountFlashState | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = count
    if (before === null || before === count) return
    serial.current += 1
    setFlash({ delta: count - before, key: serial.current })
    const timer = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(timer)
  }, [count])

  return flash
}

export function CountFlash({ flash, className = '' }: { flash: CountFlashState | null; className?: string }) {
  if (!flash) return null
  return (
    <span
      key={flash.key}
      className={`count-flash ${flash.delta > 0 ? 'is-up' : 'is-down'} ${className}`.trim()}
      data-testid="count-flash"
      aria-hidden="true"
    >
      {flash.delta > 0 ? `+${flash.delta}` : flash.delta}
    </span>
  )
}
