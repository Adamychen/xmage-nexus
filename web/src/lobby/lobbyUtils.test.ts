import { describe, expect, it } from 'vitest'
import { formatSeatHistory, getMyActiveTables, isDirectTournamentJoin, isMyTable, isUserInGame, tableOwnerName } from './lobbyUtils'
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
  it('LBY-7: a limited tournament without a password is joined directly', () => {
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Booster Draft' }))).toBe(true)
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Sealed Deck' }))).toBe(true)
  })

  it('LBY-7: a constructed tournament asks for a deck in the dialog', () => {
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Constructed - Modern' }))).toBe(false)
  })

  it('LBY-7: a tournament with a password asks for a deck in the dialog', () => {
    expect(isDirectTournamentJoin(table({ isTournament: true, gameType: 'Booster Draft', passworded: true }))).toBe(false)
  })

  it('LBY-7: a regular table is never joined directly', () => {
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

describe('formatSeatHistory', () => {
  it('shows tourneys badge when matches is 0 but tourneys exist', () => {
    const raw = 'Matches: 0 (0%), Tourneys: 157 (D:11) (7%), Constructed Rating: 800, Limited Rating: 1773'
    const res = formatSeatHistory(raw)
    expect(res.short).toBe('T:157')
    expect(res.full).toBe(raw)
  })

  it('shows matches and quit percentage when matches exist', () => {
    const raw = 'Matches: 25 (0%), Tourneys: 3, Constructed Rating: 1650, Limited Rating: 1500'
    const res = formatSeatHistory(raw)
    expect(res.short).toBe('25')
  })
})


describe('isMyTable owner match', () => {
  it("does not count another player's table as mine just because its name contains the user", () => {
    const joanna = table({ tableId: 'j', controllerName: 'joanna' })
    expect(isMyTable(joanna, 'ann')).toBe(false)
    expect(getMyActiveTables([joanna], 'ann')).toEqual([])
  })

  it('recognizes the owner by exact name, ignoring case and surrounding spaces', () => {
    const mine = table({ tableId: 'm', controllerName: 'Ann' })
    expect(isMyTable(mine, 'ann')).toBe(true)
    expect(isMyTable(mine, ' ANN ')).toBe(true)
    expect(getMyActiveTables([mine], 'ann')).toEqual([mine])
  })

  it('uses the first controllerName entry as the owner, like TableCard', () => {
    const shared = table({ tableId: 's', controllerName: 'ann, joanna' })
    expect(isMyTable(shared, 'ann')).toBe(true)
    expect(isMyTable(shared, 'joanna')).toBe(false)
  })
})

describe('tableOwnerName', () => {
  it('returns the first controller name, trimmed', () => {
    expect(tableOwnerName(table({ controllerName: ' host , guest ' }))).toBe('host')
  })
})
