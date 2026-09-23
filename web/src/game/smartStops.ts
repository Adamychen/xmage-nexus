import type { GameView, PlayableObjectStats } from '../net/types'

function hasNonManaAction(stats: PlayableObjectStats | undefined): boolean {
  if (!stats) return false
  return (stats.basicPlayAbilities?.length ?? 0) > 0
    || (stats.basicCastAbilities?.length ?? 0) > 0
    || (stats.other?.length ?? 0) > 0
}

export function meaningfulPlayables(game: GameView, playableIds: string[]): string[] {
  const ids = new Set<string>()
  for (const [id, stats] of Object.entries(game.canPlayObjects?.objects ?? {})) {
    if (hasNonManaAction(stats)) ids.add(id)
  }
  const hand = game.myHand ?? {}
  for (const id of playableIds) if (id in hand) ids.add(id)
  return [...ids]
}
