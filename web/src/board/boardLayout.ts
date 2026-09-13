import type { BoardLayoutPref } from '../state/persistence'

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
