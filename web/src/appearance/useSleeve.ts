import { useSettings, useStore } from '../state/store'
import { getSleeveDef, type SleeveDef } from './sleeves'
import { useCustomSleeve } from './customSleeve'
import { parseAppearanceToken } from './appearanceToken'

type SleeveGame =
  | {
      myPlayerId?: string | null
      players?: { playerId: string; controlled?: boolean; userData?: unknown }[]
    }
  | null
  | undefined

export function ownPlayerId(game: SleeveGame): string | undefined {
  return game?.myPlayerId ?? game?.players?.find((p) => p.controlled)?.playerId
}

/**
 * The sleeve a player declared in their `UserData` (APR-6); empty when they declared none,
 * which is every desktop client and every nexus build older than the token.
 */
export function declaredSleeveOf(game: SleeveGame, playerId: string | null | undefined): string {
  if (!playerId) return ''
  const player = game?.players?.find((p) => p.playerId === playerId)
  const raw = (player?.userData as { userIdStr?: unknown } | undefined)?.userIdStr
  return parseAppearanceToken(raw).sleeveId ?? ''
}

export function resolveSleeveFor(
  controllerId: string | null | undefined,
  myPlayerId: string | null | undefined,
  sleeveId: string,
  customImageUrl: string | null,
  declaredSleeveId = '',
): SleeveDef {
  const mine = !!controllerId && !!myPlayerId && controllerId === myPlayerId
  if (mine) return getSleeveDef(sleeveId, customImageUrl)
  return getSleeveDef(declaredSleeveId || 'classic')
}

export function useSleeveFor(controllerId: string | null | undefined): SleeveDef {
  const { sleeveId } = useSettings()
  const custom = useCustomSleeve()
  const myPlayerId = useStore((s) => ownPlayerId(s.game))
  // A catalogue id, not the player: the selector has to return the same value across frames or
  // every card on the board re-renders with each game view.
  const declared = useStore((s) =>
    controllerId && controllerId !== myPlayerId ? declaredSleeveOf(s.game, controllerId) : '',
  )
  return resolveSleeveFor(controllerId, myPlayerId, sleeveId, custom, declared)
}
