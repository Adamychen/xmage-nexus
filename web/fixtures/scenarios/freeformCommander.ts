/**
 * Freeform Commander table (`SCENARIO=freeform npm run play:fake`): the same
 * four-player board as the Commander showcase, served as a
 * `Freeform Commander Free For All` table with its own deck type and one free
 * seat, so the join dialog and its deck fit (LBY-30) can be checked by hand.
 */

import { makeBaseScenario, makeTable, type FakeConn, type Scenario } from '../fake'
import { commanderShowcaseGameView, SHOWCASE_GAME_ID } from '../../src/__fixtures__/commanderShowcase'
import type { TableView } from '../../src/net/types'

export const FREEFORM_TABLE_ID = 'table-freeform-commander'
export const FREEFORM_TABLE_NAME = 'Freeform Commander'

export function freeformCommanderScenario(): Scenario {
  let username = 'You'
  /** Once you take the free seat the table is full and yours to start. */
  let joined = false

  const getGameView = () => commanderShowcaseGameView(username)
  const select = (conn: FakeConn) => {
    const gameView = getGameView()
    conn.broadcast('GAME_UPDATE', { gameView }, SHOWCASE_GAME_ID)
    conn.broadcast('GAME_SELECT', { message: 'Play spells and abilities.', options: { specialButton: 'Pass' }, gameView }, SHOWCASE_GAME_ID)
  }

  const base = makeBaseScenario({
    tableId: FREEFORM_TABLE_ID,
    tableName: FREEFORM_TABLE_NAME,
    gameId: SHOWCASE_GAME_ID,
    gameType: 'Freeform Commander Free For All',
    getGameView,
    onStartMatch: (conn) => select(conn),
    onSendPlayerUUID: (conn) => select(conn),
    onSendPlayerBoolean: (conn) => select(conn),
    onSendPlayerAction: (conn) => select(conn),
  })

  const table = (): TableView => ({
    ...makeTable({
      tableId: FREEFORM_TABLE_ID,
      tableName: FREEFORM_TABLE_NAME,
      gameId: SHOWCASE_GAME_ID,
      gameType: 'Freeform Commander Free For All',
      deckType: 'Variant Magic - Freeform Commander',
      controllerName: joined ? username : 'Kiko',
      seats: [
        ...['Kiko', 'Marta', 'Pablo'].map((name, i) => ({ playerName: name, seatIndex: i, playerType: 'SIM' })),
        { playerName: joined ? username : '', seatIndex: 3, playerType: 'HUMAN' },
      ],
    }),
    tableState: joined ? 'READY_TO_START' : 'WAITING',
    tableStateText: joined ? 'Lista' : 'Waiting for players (3/4)',
    seatsInfo: joined ? '4/4' : '3/4',
    additionalInfoShort: 'Wins: 1, Time: None, Rng: ALL',
  })

  return {
    onConnect: (conn) => {
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([table()])
    },
    onAction: (conn, action, args, requestId) => {
      if (action === 'connect') {
        const name = String(args.username ?? '').trim()
        if (name) {
          username = name
          conn.username = name
        }
        conn.ok(requestId, action, { tableId: FREEFORM_TABLE_ID })
        conn.lobby([table()])
        return
      }
      if (action === 'createTable' || action === 'createTournamentTable') {
        conn.ok(requestId, action, { tableId: FREEFORM_TABLE_ID })
        conn.lobby([table()])
        return
      }
      base.onAction?.(conn, action, args, requestId)
      if (action === 'joinTable') {
        joined = true
        conn.lobby([table()])
      }
    },
  }
}
