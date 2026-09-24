import type { TableView } from '../net/types'

/** B.10: no auto-follow (desktop parity). When the watched game ends but its
 * table already runs a newer one (Bo3/tournament), the spectator gets a Follow
 * button. `TableView.games` follows `Match.getGames()` order (oldest first), so
 * only a game AFTER the watched one counts: earlier games are finished and the
 * server rejects `watchGame` on them (GameManagerImpl.watchGame → false). */
export function findFollowGameId(
  tables: TableView[] | undefined | null,
  watchedGameId: string | null | undefined,
): string | null {
  if (!watchedGameId) return null
  for (const t of tables ?? []) {
    const games = t.games ?? []
    const idx = games.indexOf(watchedGameId)
    if (idx >= 0) {
      return idx < games.length - 1 ? games[games.length - 1] : null
    }
  }
  return null
}
