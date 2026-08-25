import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Scenario } from '../fake'
import { TABLE_ID } from '../humanGameConstants'

// Fixture anti-drift: reproduce un GAME_INIT real capturado por
// scripts/record-mutate.mjs contra un servidor XMage real (mismo fork que
// beta.xmage.today). El permanente mutado (Elvish Mystic + Gemrazer apilados)
// viene con su `mutateView` real, así que este test prueba que el web renderiza
// la FORMA REAL del protocolo, no solo la construida a mano en mutate.ts.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RECORDED = path.join(__dirname, '..', 'recorded', 'mutate.json')

export function mutateRecordedScenario(): Scenario {
  const raw = JSON.parse(fs.readFileSync(RECORDED, 'utf8')) as { gameId: string; gameView: unknown }
  const { gameView, gameId } = raw

  const table = {
    tableId: TABLE_ID,
    tableName: 'Mutate Recorded (real frame)',
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
    onAction: (conn, action, args, requestId) => {
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
          conn.broadcast('START_GAME', { gameId, tableName: 'Mutate Recorded (real frame)' }, gameId)
          // El frame real capturado se reemite tal cual: es el gameView de una
          // partida real donde un Elvish Mystic mutó en Gemrazer.
          conn.broadcast('GAME_INIT', { gameView }, gameId)
          conn.broadcast(
            'GAME_SELECT',
            {
              message: 'Main 1: Cast spells or activate abilities',
              options: { specialButton: 'Pass' },
              gameView,
            },
            gameId,
          )
          break
        case 'sendPlayerUUID':
          conn.ok(requestId, action, {})
          // re-emite el mismo frame para no romper la interacción
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
