import { useSettings, useStore } from '../state/store'
import { getSleeveDef, type SleeveDef } from './sleeves'
import { useCustomSleeve } from './customSleeve'

export function ownPlayerId(
  game: { myPlayerId?: string | null; players?: { playerId: string; controlled?: boolean }[] } | null | undefined,
): string | undefined {
  return game?.myPlayerId ?? game?.players?.find((p) => p.controlled)?.playerId
}

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
  const myPlayerId = useStore((s) => ownPlayerId(s.game))
  return resolveSleeveFor(controllerId, myPlayerId, sleeveId, custom)
}
