import type { TableView } from '../net/types'

/** B.10: sin auto-follow (paridad desktop), el espectador recibe un aviso con
 * botón Seguir cuando su partida terminó pero la mesa ya tiene otra en curso
 * (Bo3/torneo). Devuelve el id de la partida nueva o null si no hay que seguir.
 * Nota i18n: los literales del aviso viven en GameEndDialog hasta que el carril
 * de locales extraiga las claves. */
export function findFollowGameId(
  tables: TableView[] | undefined | null,
  watchedGameId: string | null | undefined,
): string | null {
  if (!watchedGameId) return null
  for (const t of tables ?? []) {
    const games = t.games ?? []
    if (games.includes(watchedGameId)) {
      return games.filter((g) => g !== watchedGameId).pop() ?? null
    }
  }
  return null
}
