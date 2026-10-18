import type { GameView, PlayerView } from '../net/types'
import type { MatrixCommander } from '../board/commanders'
import { commanderSeats, commanderTone, seatDamage, type CommanderTone } from './commanderSeats'

export type CommanderChipTone = CommanderTone

export interface CommanderDamageChip {
  commander: MatrixCommander
  commanders: MatrixCommander[]
  dmgs: number[]
  dmg: number
  tone: CommanderChipTone
}

export function commanderChipTone(dmg: number): CommanderChipTone {
  return commanderTone(dmg)
}

export function commanderDamageChips(game: GameView | null | undefined, player: PlayerView): CommanderDamageChip[] {
  if (!game) return []
  return commanderSeats(game)
    .filter((seat) => seat.ownerId !== player.playerId)
    .map((seat) => seatDamage(game, seat, player))
    .filter((entry) => entry.max > 0)
    .sort((a, b) => b.max - a.max)
    .map((entry) => {
      const top = entry.dmgs.indexOf(entry.max)
      return {
        commander: entry.seat.commanders[top],
        commanders: entry.seat.commanders,
        dmgs: entry.dmgs,
        dmg: entry.max,
        tone: entry.tone,
      }
    })
}
