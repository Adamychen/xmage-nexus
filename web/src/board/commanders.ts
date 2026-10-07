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

const CAST_FROM_COMMAND_ZONE = /(\d+)\s+times?\s+played from the command zone/i

/** Times a commander was cast from the command zone. The server has no field for it:
 *  CommanderInfoWatcher writes "<b>Commander</b> N time(s) played from the command zone."
 *  into the card's rules, so that line is the source of truth; an explicit numeric
 *  `castCount` (fixtures) wins when present. */
export function commanderCastCount(card: unknown): number {
  const c = card as { castCount?: unknown; rules?: unknown } | null | undefined
  if (!c || typeof c !== 'object') return 0
  if (typeof c.castCount === 'number') return c.castCount
  if (!Array.isArray(c.rules)) return 0
  for (const line of c.rules) {
    const m = CAST_FROM_COMMAND_ZONE.exec(String(line).replace(/<[^>]*>/g, ''))
    if (m) return Number(m[1])
  }
  return 0
}

/** Commander cast tax: +{2} for each previous cast from the command zone. */
export function commanderTax(castCount: number): number {
  return castCount > 0 ? castCount * 2 : 0
}
