import type { GameView } from '../net/types'
import { useStore, setSpotlight } from '../state/store'

export interface SpotlightChoice {
  playerId: string
  pickedIn: string | null
}

export function declarationKey(turn: number, combatMode: 'attack' | 'block' | null): string | null {
  return combatMode === null ? null : `${turn}:${combatMode}`
}

export function spotlightActive({ enabled, arenaLayout, isSpectator, liveOppCount }: {
  enabled: boolean
  arenaLayout: boolean
  isSpectator: boolean
  liveOppCount: number
}): boolean {
  return enabled && arenaLayout && liveOppCount >= (isSpectator ? 3 : 2)
}

export function mainSeatId({ chosen, homeId, liveOppIds, declaration }: {
  chosen: SpotlightChoice | null
  homeId: string
  liveOppIds: readonly string[]
  declaration: string | null
}): string {
  if (!chosen || (chosen.playerId !== homeId && !liveOppIds.includes(chosen.playerId))) return homeId
  if (declaration !== null && chosen.pickedIn !== declaration) return homeId
  return chosen.playerId
}

export function chooseMainSeat(clicked: string, declaration: string | null): SpotlightChoice {
  return { playerId: clicked, pickedIn: declaration }
}

export function panelSeatIds(playerIds: readonly string[], homeId: string, mainId: string): string[] {
  const index = playerIds.indexOf(homeId)
  const ordered = index === -1
    ? [...playerIds]
    : [...playerIds.slice(index + 1), ...playerIds.slice(0, index + 1)]
  return ordered.filter((id) => id !== mainId)
}

export function choiceForGame(
  stored: { gameId: string; playerId: string; pickedIn: string | null } | null,
  gameId: string | null,
): SpotlightChoice | null {
  return stored && stored.gameId === gameId ? { playerId: stored.playerId, pickedIn: stored.pickedIn } : null
}

export function useSpotlight(game: GameView | null, homeId: string | undefined, liveOppIds: readonly string[], combatMode: 'attack' | 'block' | null) {
  const spotlight = useStore((s) => s.spotlight)
  const gameId = useStore((s) => s.gameId)
  const declaration = declarationKey(game?.turn ?? 0, combatMode)
  const mainId = homeId
    ? mainSeatId({ chosen: choiceForGame(spotlight, gameId), homeId, liveOppIds, declaration })
    : undefined
  const select = (playerId: string) => {
    if (gameId === null) return
    setSpotlight({ gameId, ...chooseMainSeat(playerId, declaration) })
  }
  return { mainId, select }
}
