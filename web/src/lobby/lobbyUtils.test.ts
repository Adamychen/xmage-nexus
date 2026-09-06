import { describe, expect, it } from 'vitest'
import { isDirectTournamentJoin } from './lobbyUtils'
import type { TableView } from '../net/types'

function table(over: Partial<TableView>): TableView {
  return {
    tableId: 't1',
    tableName: 'T',
    controllerName: 'host',
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Modern',
    additionalInfoShort: '',
    additionalInfoFull: '',
    createTime: 0,
    tableState: 'WAITING',
    skillLevel: 'CASUAL',
    tableStateText: '',
    seatsInfo: '',
    isTournament: false,
    seats: [],
    games: [],
    quitRatio: '',
    minimumRating: '',
    limited: false,
    rated: false,
    passworded: false,
    spectatorsAllowed: true,
    ...over,
  }
}

describe('isDirectTournamentJoin', () => {
  it('torneo limitado sin password entra directo', () => {
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Booster Draft' }))).toBe(true)
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Sealed Deck' }))).toBe(true)
  })

  it('torneo construido pide mazo en el diálogo', () => {
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Constructed - Modern' }))).toBe(false)
  })

  it('torneo con password pide mazo en el diálogo', () => {
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Booster Draft', passworded: true }))).toBe(false)
  })

  it('mesa normal nunca entra directo', () => {
    expect(isDirectTournamentJoin(table({ isTournament: false, gameType: 'Booster Draft' }))).toBe(false)
  })
})
