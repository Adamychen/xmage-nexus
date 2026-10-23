import { useEffect, useState, useSyncExternalStore } from 'react'
import { combatImpactUntil, subscribeCombatImpacts } from './combatStrikes'

export function useCombatHeld<T>(id: string | null | undefined, value: T): T {
  const [released, setReleased] = useState(value)
  const until = useSyncExternalStore(subscribeCombatImpacts, () => combatImpactUntil(id))
  const wait = Object.is(released, value) ? 0 : Math.max(0, until - Date.now())
  const holding = wait > 0

  useEffect(() => {
    if (!holding) {
      setReleased(value)
      return
    }
    const timer = setTimeout(() => setReleased(value), wait)
    return () => clearTimeout(timer)
  }, [value, holding, until])

  return holding ? released : value
}
