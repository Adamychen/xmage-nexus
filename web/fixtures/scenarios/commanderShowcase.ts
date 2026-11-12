/**
 * Commander showcase: the turn-11 four-player Commander table of `src/__fixtures__/commanderShowcase.ts`
 * (four real precons) served by the FakeServer for manual UI checks (`SCENARIO=showcase npm run play:fake`).
 * The state is fixed: passing or clicking sends the same table back.
 */

import { makeBaseScenario, makeTable, type FakeConn, type Scenario } from '../fake'
import { commanderShowcaseGameView, SHOWCASE_GAME_ID } from '../../src/__fixtures__/commanderShowcase'
import type { TableView } from '../../src/net/types'

export const SHOWCASE_TABLE_ID = 'table-commander-showcase'
export const SHOWCASE_TABLE_NAME = 'Commander showcase'

export function commanderShowcaseScenario(): Scenario {
  let username = 'You'

  const getGameView = () => commanderShowcaseGameView(username)
  const select = (conn: FakeConn) => {
    const gameView = getGameView()
    conn.broadcast('GAME_UPDATE', { gameView }, SHOWCASE_GAME_ID)
    conn.broadcast('GAME_SELECT', { message: 'Play spells and abilities.', options: { specialButton: 'Pass' }, gameView }, SHOWCASE_GAME_ID)
  }

  const base = makeBaseScenario({
    tableId: SHOWCASE_TABLE_ID,
    tableName: SHOWCASE_TABLE_NAME,
    gameId: SHOWCASE_GAME_ID,
    gameType: 'Commander Free For All',
    getGameView,
    onStartMatch: (conn) => select(conn),
    onSendPlayerUUID: (conn) => select(conn),
    onSendPlayerBoolean: (conn) => select(conn),
    onSendPlayerAction: (conn) => select(conn),
  })

  const table = (): TableView => ({
    ...makeTable({
      tableId: SHOWCASE_TABLE_ID,
      tableName: SHOWCASE_TABLE_NAME,
      gameId: SHOWCASE_GAME_ID,
      gameType: 'Commander Free For All',
      deckType: 'Variant Magic - Commander',
      controllerName: username,
      seats: [
        { playerName: username, seatIndex: 0, playerType: 'HUMAN' },
        ...['Kiko', 'Marta', 'Pablo'].map((name, i) => ({ playerName: name, seatIndex: i + 1, playerType: 'SIM' })),
      ],
    }),
    seatsInfo: '4/4',
    additionalInfoShort: '4/4',
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
        conn.ok(requestId, action, { tableId: SHOWCASE_TABLE_ID })
        conn.lobby([table()])
        return
      }
      if (action === 'createTable' || action === 'createTournamentTable') {
        conn.ok(requestId, action, { tableId: SHOWCASE_TABLE_ID })
        conn.lobby([table()])
        return
      }
      base.onAction?.(conn, action, args, requestId)
    },
  }
}
