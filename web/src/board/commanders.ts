import type { CardView, GameView, PlayerView } from '../net/types'
import { parseCommandList } from './CommandZone'

export interface CommanderInfo {
  id: string
  name: string
  card: CardView
  isCompanion: boolean
  castCount: number
}

/** Comandantes (y companion) de un jugador según el parseo canónico de
 *  CommandZone (parseCommandList). Única fuente de verdad compartida por la
 *  zona de comando, la pestaña CDM y el gating del tablero. */
export function commandersOf(player: PlayerView | undefined): CommanderInfo[] {
  if (!player) return []
  const items = parseCommandList(player.commandList, player.helperCards ?? {})
  return items
    .filter((i) => i.isCommander || i.isCompanion)
    .map((i) => ({
      id: i.id,
      name: i.card.displayName || i.card.name || '',
      card: i.card,
      isCompanion: i.isCompanion,
      castCount: i.castCount,
    }))
}

/** ¿Hay algún comandante en la partida? (gating de la pestaña CDM). */
export function hasCommanders(game: GameView | null): boolean {
  return (game?.players ?? []).some((p) => commandersOf(p).length > 0)
}

/** Impuesto de lanzamiento de comandante: +{2 por cada vez lanzado}. */
export function commanderTax(castCount: number): number {
  return castCount > 0 ? castCount * 2 : 0
}
