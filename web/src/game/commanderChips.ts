import type { GameView, PlayerView } from '../net/types'
import { commanderDamageDealt, syncCommanderMemory, type MatrixCommander } from '../board/commanders'
import { COMMANDER_LETHAL, COMMANDER_WARNING } from './CommanderDamageMatrix'

export type CommanderChipTone = 'normal' | 'warning' | 'lethal'

export interface CommanderDamageChip {
  commander: MatrixCommander
  dmg: number
  tone: CommanderChipTone
}

export function commanderChipTone(dmg: number): CommanderChipTone {
  if (dmg >= COMMANDER_LETHAL) return 'lethal'
  if (dmg >= COMMANDER_WARNING) return 'warning'
  return 'normal'
}

export function commanderDamageChips(game: GameView | null | undefined, player: PlayerView): CommanderDamageChip[] {
  if (!game) return []
  return syncCommanderMemory(game)
    .filter((c) => (!c.isCompanion || c.isCommander) && c.ownerId !== player.playerId)
    .map((commander) => ({ commander, dmg: commanderDamageDealt(game, commander, player) }))
    .filter((entry) => entry.dmg > 0)
    .sort((a, b) => b.dmg - a.dmg)
    .map((entry) => ({ ...entry, tone: commanderChipTone(entry.dmg) }))
}
