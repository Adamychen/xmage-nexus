import type { GameView } from '../net/types'

/** Control del turno ajeno (Mindslaver & cía.): el servidor manda la mano del
 *  jugador controlado en `opponentHands` y le da la prioridad en su nombre.
 *  La clave existe durante TODO el turno controlado (aunque su mano esté
 *  vacía: `GameSessionPlayer.processControlledPlayers` la repuebla cada vista),
 *  así que la presencia de la clave —no que tenga cartas— es el indicador. */
export interface ControlInfo {
  /** Nombres visibles de los jugadores cuyo turno controlamos. */
  controlledNames: Set<string>
  /** La prioridad pendiente pertenece a un jugador controlado. */
  priorityIsControlled: boolean
  /** Nombre visible del jugador que actúa (prioridad; si no, el activo). */
  actingName: string | null
}

export function controlInfo(game: GameView | null | undefined): ControlInfo {
  const players = game?.players ?? []
  const hands = game?.opponentHands
  const keys = hands && typeof hands === 'object' ? Object.keys(hands) : []
  const nameOf = (key: string) => players.find((p) => p.playerId === key || p.name === key)?.name ?? key
  const controlledNames = new Set(keys.map(nameOf))
  const priorityName = game?.priorityPlayerName || players.find((p) => p.hasPriority)?.name || ''
  const priorityIsControlled =
    priorityName !== '' && (controlledNames.has(priorityName) || keys.includes(priorityName))
  const acting = priorityName || game?.activePlayerName || players.find((p) => p.isActive)?.name || ''
  return { controlledNames, priorityIsControlled, actingName: acting ? nameOf(acting) : null }
}

/** ¿La prioridad pendiente es de un jugador bajo nuestro control? */
export function isControllingPriority(game: GameView | null | undefined): boolean {
  return controlInfo(game).priorityIsControlled
}
