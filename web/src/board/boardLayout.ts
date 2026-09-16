import type { BoardLayoutPref } from '../state/persistence'
import { MAX_BOARD_PLAYERS } from './boardShared'

export function resolveBoardLayout(
  layout: BoardLayoutPref,
  manual: boolean,
  opponentCount: number,
): BoardLayoutPref {
  const multiplayer = opponentCount >= 2
  if (layout === 'arena') return multiplayer ? 'arena' : 'standard'
  if (layout === 'pod') return 'pod'
  if (multiplayer && !manual) return 'pod'
  return 'standard'
}

/**
 * FFA de 5+ jugadores solo es posible en standard: pod/arena recortan a
 * MAX_BOARD_PLAYERS sin switcher (pod) y el standard muestra a todos los
 * rivales de uno en uno con el OpponentSwitcherBar (GameBoard no recorta).
 */
export function effectiveBoardLayout(
  layout: BoardLayoutPref,
  manual: boolean,
  opponentCount: number,
  totalPlayers: number,
): BoardLayoutPref {
  if (totalPlayers > MAX_BOARD_PLAYERS) return 'standard'
  return resolveBoardLayout(layout, manual, opponentCount)
}
