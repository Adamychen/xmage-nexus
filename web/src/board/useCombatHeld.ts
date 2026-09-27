import { useEffect, useState } from 'react'
import { combatImpactRemaining } from './combatStrikes'

export function useCombatHeld<T>(id: string | null | undefined, value: T): T {
  const [released, setReleased] = useState(value)
  const wait = Object.is(released, value) ? 0 : combatImpactRemaining(id)
  const holding = wait > 0

  useEffect(() => {
    if (!holding) {
      setReleased(value)
      return
    }
    const timer = setTimeout(() => setReleased(value), wait)
    return () => clearTimeout(timer)
  }, [value, holding])

  return holding ? released : value
}
