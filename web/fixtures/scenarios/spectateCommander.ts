/**
 * Spectating a running Commander pod: the waiting room a watcher sees between the
 * accepted watch and the first game view.
 *
 * Models what the real server does on `watchTable` (`TableController.watchTable`): it
 * answers ok and fires a WATCHGAME callback carrying the table ids, nothing else. The
 * game view only follows once the watcher is registered, so the waiting room is what
 * the spectator looks at meanwhile; this scenario stops there on purpose, so the screen
 * can be inspected (LBY-33). A second `watchGame` for the same game is refused, the way
 * `GameController.watch` refuses a watcher it already has.
 */

import { makeBaseScenario, type FakeConn, type Scenario } from '../fake'
import { playerGameView } from '../../src/__fixtures__/gameViews'
import type { SeatView, TableView } from '../../src/net/types'

export const SPECTATE_TABLE_ID = 'table-spectate-commander'
export const SPECTATE_GAME_ID = 'game-spectate-commander'
export const SPECTATE_TABLE_NAME = 'Commander pod'

const SEATS: SeatView[] = [
  { playerName: 'host', seatIndex: 0, playerType: 'HUMAN' },
  { playerName: 'alice', seatIndex: 1, playerType: 'HUMAN' },
  { playerName: 'bob', seatIndex: 2, playerType: 'HUMAN' },
  { playerName: 'charlie', seatIndex: 3, playerType: 'HUMAN' },
]

function runningPod(): TableView {
  return {
    tableId: SPECTATE_TABLE_ID,
    tableName: SPECTATE_TABLE_NAME,
    gameType: 'Commander Free For All',
    deckType: 'Variant Magic - Commander',
    controllerName: 'host',
    additionalInfoShort: '4/4',
    additionalInfoFull: '',
    createTime: Date.now(),
    tableState: 'DUELING',
    skillLevel: 'Casual',
    tableStateText: 'Dueling',
    seatsInfo: '4/4',
    isTournament: false,
    seats: SEATS,
    games: [SPECTATE_GAME_ID],
    quitRatio: '100',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
    spectatorsAllowed: true,
  }
}

/**
 * @param watchGameCalls collects every `watchGame` the client sends, so a test can
 *   assert that a watch the client already holds is not sent again.
 * @param repeatWatchGameEvent fires the WATCHGAME callback twice for one watch, the way
 *   the proxy replays a callback that lagged behind an update flood.
 */
export function spectateCommanderScenario(
  watchGameCalls: string[] = [],
  repeatWatchGameEvent = false,
): Scenario {
  const table = runningPod()
  let watching = false
  return makeBaseScenario({
    tableId: SPECTATE_TABLE_ID,
    tableName: SPECTATE_TABLE_NAME,
    gameId: SPECTATE_GAME_ID,
    gameView: playerGameView,
    seats: SEATS,
    gameType: table.gameType,
    onConnect: (conn: FakeConn) => conn.lobby([table]),
    onRequest: (conn, action, args, requestId) => {
      // The base scenario answers `connect` with its own table, which allows no
      // spectators and has not started: publish the running pod instead.
      if (action === 'connect') {
        const username = String((args as Record<string, unknown>).username ?? '').trim()
        if (username) conn.username = username
        conn.ok(requestId, action, { tableId: SPECTATE_TABLE_ID })
        conn.lobby([table])
        return true
      }
      if (action === 'watchTable') {
        conn.ok(requestId, action, {})
        conn.lobby([table])
        const watchGameEvent = () =>
          conn.event('WATCHGAME', { currentTableId: SPECTATE_TABLE_ID, parentTableId: null }, SPECTATE_GAME_ID)
        watchGameEvent()
        if (repeatWatchGameEvent) setTimeout(watchGameEvent, 150)
        return true
      }
      if (action === 'watchGame') {
        watchGameCalls.push(String((args as Record<string, unknown>).gameId ?? ''))
        if (watching) {
          conn.fail(requestId, action, 'Command failed')
        } else {
          watching = true
          conn.ok(requestId, action, {})
        }
        return true
      }
      return false
    },
  })
}
