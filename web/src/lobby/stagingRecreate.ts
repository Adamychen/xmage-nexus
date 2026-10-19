import type { CreateTableArgs } from '../net/commands'
import type { DeckJson, TableView } from '../net/types'
import { DEFAULT_ATTACK_OPTION, DEFAULT_RANGE } from './CreateTable/constants'

export function recreateTableArgs(table: TableView, deck: DeckJson, password?: string): CreateTableArgs {
  const seats = table.seats ?? []
  const simSeats = seats.filter((s) => s.playerType === 'SIM').length
  return {
    name: table.tableName,
    gameType: table.gameType,
    deckType: table.deckType,
    winsNeeded: 1,
    playerTypes: seats.map((s) => s.playerType || 'HUMAN'),
    password: password?.trim() || undefined,
    skillLevel: table.skillLevel || 'CASUAL',
    rated: table.rated,
    spectatorsAllowed: table.spectatorsAllowed,
    attackOption: DEFAULT_ATTACK_OPTION,
    range: DEFAULT_RANGE,
    simDecks: simSeats > 0 ? Array.from({ length: simSeats }, () => deck) : undefined,
  }
}
