import { TABLE } from '../table-names'
/**
 * Escenario del FixtureServer para decks-gallery.spec.ts: solo login y lobby.
 * La galería de mazos, el builder y el Deck Browser (meta decks) son
 * client-side (metaDeckCatalog.ts), así que el servidor no necesita partida.
 */

import type { FakeConn, Scenario } from '../fake'
import type { TableView } from '../../src/net/types'

const TABLE_ID = 'table-decks-1'

function demoTable(): TableView {
  return {
    tableId: TABLE_ID,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Modern',
    tableName: TABLE.decksGallery,
    controllerName: 'player-1',
    additionalInfoShort: '1/2',
    additionalInfoFull: '',
    createTime: Date.now(),
    tableState: 'WAITING',
    skillLevel: 'Casual',
    tableStateText: 'Esperando jugadores',
    seatsInfo: 'player-1',
    isTournament: false,
    seats: [{ playerName: 'player-1', seatIndex: 0, playerType: 'HUMAN' }],
    games: [],
    quitRatio: '100',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
    spectatorsAllowed: true,
  }
}

export function decksGalleryScenario(): Scenario {
  return {
    onConnect(conn: FakeConn) {
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
    },
    onStart(conn: FakeConn) {
      conn.lobby([demoTable()])
      const lobbyTimer = setInterval(() => conn.lobby([demoTable()]), 2000)
      return () => clearInterval(lobbyTimer)
    },
    onAction(conn, action, requestId) {
      switch (action) {
        case 'connect':
          conn.ok(requestId, action, {})
          break
        case 'disconnect':
          break
        default:
          conn.ok(requestId, action, undefined)
          break
      }
    },
  }
}
