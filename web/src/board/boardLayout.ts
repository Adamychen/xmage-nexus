import type { BoardLayoutPref } from '../state/persistence'
import { MAX_BOARD_PLAYERS } from './boardShared'

export function resolveBoardLayout(
  layout: BoardLayoutPref,
  manual: boolean,
  opponentCount: number,
): BoardLayoutPref {
  const multiplayer = opponentCount >= 2
  if (layout === 'arena') return multiplayer ? 'arena' : 'standard'
  // A table of three or more that was never set by hand opens on the Arena board: it is the one
  // that seats everybody at once now that the 2x2 pod is gone.
  if (multiplayer && !manual) return 'arena'
  return 'standard'
}

/**
 * A free-for-all of five or more is only possible on the standard board: the Arena one seats
 * MAX_BOARD_PLAYERS and has no switcher, while the standard board shows the opponents one at a
 * time with the OpponentSwitcherBar and leaves nobody out.
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
