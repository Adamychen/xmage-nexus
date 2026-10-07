import { useSettings, useStore } from '../state/store'
import { getSleeveDef, type SleeveDef } from './sleeves'
import { useCustomSleeve } from './customSleeve'

export function resolveSleeveFor(
  controllerId: string | null | undefined,
  myPlayerId: string | null | undefined,
  sleeveId: string,
  customImageUrl: string | null,
): SleeveDef {
  const mine = !!controllerId && !!myPlayerId && controllerId === myPlayerId
  return mine ? getSleeveDef(sleeveId, customImageUrl) : getSleeveDef('classic')
}

export function useSleeveFor(controllerId: string | null | undefined): SleeveDef {
  const { sleeveId } = useSettings()
  const custom = useCustomSleeve()
  const myPlayerId = useStore((s) => s.game?.myPlayerId)
  return resolveSleeveFor(controllerId, myPlayerId, sleeveId, custom)
}
