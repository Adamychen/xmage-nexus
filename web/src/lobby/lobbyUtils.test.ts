import { describe, expect, it } from 'vitest'
import { isDirectTournamentJoin, isUserInGame } from './lobbyUtils'
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

describe('isUserInGame (AUDIT)', () => {
  it('solo los tokens de juego cuentan como en partida', () => {
    expect(isUserInGame('')).toBe(false)
    expect(isUserInGame(null)).toBe(false)
    expect(isUserInGame('not active')).toBe(false)
    expect(isUserInGame('Wait: 1 ')).toBe(false)
    expect(isUserInGame('Watch: 2 ')).toBe(false)
    expect(isUserInGame('Match: 1 ')).toBe(true)
    expect(isUserInGame('Sideb: 1 ')).toBe(true)
    expect(isUserInGame('Draft: 1 ')).toBe(true)
    expect(isUserInGame('Const: 1 ')).toBe(true)
    expect(isUserInGame('Tourn: 1 ')).toBe(true)
    expect(isUserInGame('Wait: 1 Match: 1 ')).toBe(true)
  })
})
