import type { GameView } from '../net/types'
import { isPlayerOut, MAX_BOARD_PLAYERS } from './boardShared'
import { useEffect } from 'react'
import { useStore, setSpotlight } from '../state/store'

export interface SpotlightChoice {
  playerId: string
  pickedIn: string | null
}

export function declarationKey(turn: number, combatMode: 'attack' | 'block' | null): string | null {
  return combatMode === null ? null : `${turn}:${combatMode}`
}

export function spotlightActive({ enabled, isSpectator, liveOppCount, totalPlayers }: {
  enabled: boolean
  isSpectator: boolean
  liveOppCount: number
  totalPlayers: number
}): boolean {
  return (enabled || totalPlayers > MAX_BOARD_PLAYERS) && liveOppCount >= (isSpectator ? 2 : 1)
}

/** BRD-57: a seat that is out of the game never holds the main area while anyone is still playing.
 *  The home seat is where the view falls back to, and when that seat is out itself (the player lost,
 *  or the spectator's home seat did) the first seat still playing takes its place. */
export function mainSeatId({ chosen, homeId, homeOut = false, liveOppIds, declaration }: {
  chosen: SpotlightChoice | null
  homeId: string
  homeOut?: boolean
  liveOppIds: readonly string[]
  declaration: string | null
}): string {
  const home = homeOut ? liveOppIds[0] ?? homeId : homeId
  const alive = chosen ? (chosen.playerId === homeId ? !homeOut : liveOppIds.includes(chosen.playerId)) : false
  if (!chosen || !alive) return home
  if (declaration !== null && chosen.pickedIn !== declaration) return home
  return chosen.playerId
}

export function chooseMainSeat(clicked: string, declaration: string | null): SpotlightChoice {
  return { playerId: clicked, pickedIn: declaration }
}

/**
 * BRD-6: every seat of the table, in turn order after the player's own, which goes last. The seat
 * drawn in the main area is in the list too: its place in the panel is its place for the whole
 * game, so switching boards never shuffles the column under the pointer.
 */
export function panelSeatIds(playerIds: readonly string[], homeId: string): string[] {
  const index = playerIds.indexOf(homeId)
  if (index === -1) return [...playerIds]
  return [...playerIds.slice(index + 1), ...playerIds.slice(0, index + 1)]
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
  const followTurn = useStore((s) => s.settings.spotlightFollowTurn)
  const declaration = declarationKey(game?.turn ?? 0, combatMode)
  const homeOut = isPlayerOut(game?.players?.find((p) => p.playerId === homeId))
  const mainId = homeId
    ? mainSeatId({ chosen: choiceForGame(spotlight, gameId), homeId, homeOut, liveOppIds, declaration })
    : undefined
  const select = (playerId: string) => {
    if (gameId === null) return
    // BRD-57: a seat out of the game cannot be brought to the main area at all.
    if (playerId === homeId ? homeOut : !liveOppIds.includes(playerId)) return
    setSpotlight({ gameId, ...chooseMainSeat(playerId, declaration) })
  }

  // BRD-71: with the setting on, every new turn brings the active player's board to the main area,
  // as if the player had clicked its copy. It runs on the turn and not on every view, so a pick
  // made during the turn stands until the next one.
  const activeId = game?.activePlayerId ?? null
  const turn = game?.turn ?? 0
  useEffect(() => {
    if (!followTurn || gameId === null || !activeId || !homeId) return
    if (activeId === homeId ? homeOut : !liveOppIds.includes(activeId)) return
    setSpotlight({ gameId, ...chooseMainSeat(activeId, null) })
    // The turn is what triggers this; the rest is read when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followTurn, gameId, turn, activeId])

  return { mainId, select }
}
