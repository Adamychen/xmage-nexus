import { useMemo } from 'react'
import type { PlayerView } from '../net/types'
import { useCombatHeld } from '../board/useCombatHeld'
import { useCounterPulse, type CounterPulse, type CounterSample } from '../board/useCounterPulse'

const FIELD = '\u0000'
const ENTRY = '\u0001'

function counterKey(player: PlayerView): string {
  return (player.counters ?? [])
    .filter((c) => c.count > 0)
    .map((c) => `${c.name}${FIELD}${c.count}`)
    .join(ENTRY)
}

function parseCounters(key: string): CounterSample[] {
  if (!key) return []
  return key.split(ENTRY).map((entry) => {
    const [name, count] = entry.split(FIELD)
    return { name, count: Number(count) }
  })
}

/**
 * A player's counters as the info bar shows them, and the ones whose count just changed. Like the
 * life total, a change dealt by a combat strike (infect, toxic) waits for that strike to land, and a
 * counter the player did not have yet counts as 0, so the first poison counter pulses too.
 */
export function usePlayerCounters(player: PlayerView): { counters: CounterSample[]; pulses: Record<string, CounterPulse> } {
  const shownKey = useCombatHeld(player.playerId, counterKey(player))
  const counters = useMemo(() => parseCounters(shownKey), [shownKey])
  const pulses = useCounterPulse(counters, true)
  return { counters, pulses }
}
