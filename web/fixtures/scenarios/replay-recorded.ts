import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Scenario } from '../fake'
import { TABLE_ID } from '../humanGameConstants'

// Escenario genérico anti-deriva: reemite un frame real capturado por
// scripts/record.mjs (web/fixtures/recorded/<filename>) como GAME_INIT, de modo
// que el web lo renderice SIN necesidad del servidor real (ni de beta). Esto
// prueba que el cliente pinta la FORMA REAL del protocolo, no solo la construida
// a mano en scenarios/*.ts.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RECORDED_DIR = path.join(__dirname, '..', 'recorded')

export const REPLAY_TABLE_NAME = 'Replay Recorded (real frame)'

export function replayRecordedScenario(filename: string): Scenario {
  const raw = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, filename), 'utf8')) as {
    gameId: string
    gameView: unknown
  }
  const { gameView, gameId } = raw

  const table = {
    tableId: TABLE_ID,
    tableName: REPLAY_TABLE_NAME,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Pioneer',
    controllerName: 'e2e',
    additionalInfoShort: '2/2',
    additionalInfoFull: '',
    createTime: Date.now(),
    tableState: 'READY_TO_START',
    skillLevel: 'Casual',
    tableStateText: 'Lista',
    seatsInfo: '2/2',
    isTournament: false,
    seats: [
      { playerName: 'e2e', seatIndex: 0, playerType: 'HUMAN' },
      { playerName: 'sim', seatIndex: 1, playerType: 'SIM' },
    ],
    games: [gameId],
    quitRatio: '100',
    minimumRating: '0',
    limited: false,
  }

  return {
    onConnect: (conn) => {
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([table])
    },
    onAction: (conn, action, _args, requestId) => {
      switch (action) {
        case 'connect':
          conn.ok(requestId, action, {})
          break
        case 'createTable':
          conn.ok(requestId, action, { tableId: TABLE_ID })
          conn.lobby([table])
          break
        case 'startMatch':
          conn.ok(requestId, action, {})
          conn.broadcast('START_GAME', { gameId, tableName: REPLAY_TABLE_NAME }, gameId)
          conn.broadcast('GAME_INIT', { gameView }, gameId)
          conn.broadcast(
            'GAME_SELECT',
            { message: 'Main 1: Cast spells or activate abilities', options: { specialButton: 'Pass' }, gameView },
            gameId,
          )
          break
        case 'sendPlayerUUID':
          conn.ok(requestId, action, {})
          conn.broadcast('GAME_UPDATE', { gameView }, gameId)
          break
        case 'sendPlayerAction':
        case 'sendPlayerBoolean':
        case 'sendPlayerInteger':
        case 'sendPlayerString':
          conn.ok(requestId, action, {})
          conn.broadcast('GAME_UPDATE', { gameView }, gameId)
          break
        default:
          conn.ok(requestId, action, undefined)
          break
      }
    },
  }
}
