import { describe, expect, it } from 'vitest'
import { recreateTableArgs } from './stagingRecreate'
import type { DeckJson, TableView } from '../net/types'

const deck = { name: 'Test', cards: [], sideboard: [] } as unknown as DeckJson

function table(seats: TableView['seats']): TableView {
  return {
    tableId: 't1', tableName: 'Pod', controllerName: 'Alice', gameType: 'Commander Free For All', deckType: 'Variant Magic - Commander',
    additionalInfoShort: '', additionalInfoFull: '', createTime: 0, tableState: 'WAITING', skillLevel: 'CASUAL',
    tableStateText: '', seatsInfo: '1/4', isTournament: false, seats, games: [], quitRatio: '0%', minimumRating: '0',
    limited: false, rated: false, passworded: false, spectatorsAllowed: true,
  } as TableView
}

describe('recreateTableArgs', () => {
  const pod = table([
    { playerName: 'Alice', seatIndex: 0, playerType: 'HUMAN' },
    { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
    { playerName: 'Bot', seatIndex: 2, playerType: 'SIM' },
    { playerName: '', seatIndex: 3 },
  ] as TableView['seats'])

  it('recreates a table as free for all across the whole table, not the server default of attack left', () => {
    const args = recreateTableArgs(pod, deck)
    expect(args.attackOption).toBe('MULTIPLE')
    expect(args.range).toBe('ALL')
  })

  it('keeps the seats, the table settings and gives each SIM seat the new deck', () => {
    const args = recreateTableArgs(pod, deck, '  secret ')
    expect(args).toMatchObject({
      name: 'Pod', gameType: 'Commander Free For All', deckType: 'Variant Magic - Commander', winsNeeded: 1,
      playerTypes: ['HUMAN', 'HUMAN', 'SIM', 'HUMAN'], password: 'secret', skillLevel: 'CASUAL', rated: false, spectatorsAllowed: true,
    })
    expect(args.simDecks).toEqual([deck])
  })

  it('sends no password or SIM decks when there are none', () => {
    const args = recreateTableArgs(table([{ playerName: 'Alice', seatIndex: 0, playerType: 'HUMAN' }] as TableView['seats']), deck, '  ')
    expect(args.password).toBeUndefined()
    expect(args.simDecks).toBeUndefined()
  })
})
