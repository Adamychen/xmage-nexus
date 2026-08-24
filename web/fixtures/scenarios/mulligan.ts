import type { Scenario } from '../fake'
import { makeGameView, makePlayer, makePermanent, makeCard } from '../../src/__fixtures__/gameViews'
import { GAME_ID, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_NAME, SIM_PLAYER_ID, TABLE_ID } from '../humanGameConstants'

const HAND_IDS = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']

/**
 * Escenario estático para ejercitar la ventana de mulligan en E2E (auto-keep
 * desactivado): arranca la partida y emite el GAME_ASK de mulligan. A diferencia
 * del motor HumanGame, NO auto-avanza la partida, así que el feedback del mulligan
 * no se pisa con GAME_SELECT posteriores.
 *  - Keep hand (boolean=false) → GAME_SELECT (sigue la partida).
 *  - Mulligan (boolean=true) → GAME_TARGET de London (poner carta al fondo) y al
 *    recibir el UUID elegido → GAME_SELECT.
 */
export function mulliganScenario(): Scenario {
  const hand: Record<string, ReturnType<typeof makeCard>> = {}
  HAND_IDS.forEach((id, i) => {
    hand[id] = makeCard({ name: ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Lightning Bolt', 'Shock', 'Shock'][i], cardTypes: ['Instant'], manaValue: 1 })
  })

  const gameView = makeGameView({
    gameId: GAME_ID,
    turn: 1,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID,
    priorityPlayerId: HUMAN_PLAYER_ID,
    myHand: hand,
    players: [
      makePlayer({
        playerId: HUMAN_PLAYER_ID,
        name: HUMAN_NAME,
        controlled: true,
        isHuman: true,
        life: 20,
        battlefield: {
          land1: makePermanent({ id: 'land1', name: 'Mountain', parentId: 'land1', controlled: true, cardTypes: ['Land'] }),
        },
      }),
      makePlayer({
        playerId: SIM_PLAYER_ID,
        name: SIM_NAME,
        controlled: false,
        isHuman: false,
        life: 20,
        battlefield: {
          oppLand1: makePermanent({ id: 'oppLand1', name: 'Island', parentId: 'oppLand1', cardTypes: ['Land'] }),
        },
      }),
    ],
  })

  const table = (name: string) => ({
    tableId: TABLE_ID,
    tableName: name,
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Modern',
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
      { playerName: HUMAN_NAME, seatIndex: 0, playerType: 'HUMAN' },
      { playerName: SIM_NAME, seatIndex: 1, playerType: 'SIM' },
    ],
    games: [GAME_ID],
    quitRatio: '100',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
    spectatorsAllowed: true,
  })

  const proceed = (conn: Parameters<Scenario['onAction']>[0]) =>
    conn.broadcast(
      'GAME_SELECT',
      { message: 'Main 1: Cast spells or activate abilities', options: { specialButton: 'Pass' }, gameView },
      GAME_ID,
    )

  return {
    onConnect: (conn) => {
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([table('Mulligan Showcase')])
    },
    onAction: (conn, action, args, requestId) => {
      switch (action) {
        case 'connect':
          conn.ok(requestId, action, {})
          break
        case 'createTable':
          conn.ok(requestId, action, { tableId: TABLE_ID })
          conn.lobby([table(String((args as { name?: string })?.name ?? 'Mulligan Showcase'))])
          break
        case 'startMatch':
          conn.ok(requestId, action, {})
          conn.broadcast('START_GAME', { gameId: GAME_ID, tableName: 'Mulligan Showcase' }, GAME_ID)
          conn.broadcast('GAME_INIT', { gameView }, GAME_ID)
          // ventana de mulligan (el cliente, con auto-keep off, la pinta)
          conn.broadcast(
            'GAME_ASK',
            {
              question: 'Keep your hand or mulligan?',
              message: 'Keep your hand or mulligan?',
              options: ['Keep hand', 'Mulligan'],
              gameId: GAME_ID,
            },
            GAME_ID,
          )
          break
        case 'sendPlayerBoolean': {
          conn.ok(requestId, action, {})
          const takeMulligan = (args as { value?: boolean } | undefined)?.value === true
          if (takeMulligan) {
            conn.broadcast(
              'GAME_TARGET',
              {
                message: 'Select a card to put on the bottom of your library',
                secondMessage: 'London mulligan: 1 more',
                targets: HAND_IDS,
                flag: true,
                gameId: GAME_ID,
              },
              GAME_ID,
            )
          } else {
            proceed(conn)
          }
          break
        }
        case 'sendPlayerUUID':
          conn.ok(requestId, action, {})
          proceed(conn)
          break
        case 'sendPlayerString':
        case 'sendPlayerInteger':
          conn.ok(requestId, action, {})
          break
        default:
          conn.ok(requestId, action, undefined)
          break
      }
    },
  }
}

export const MULLIGAN_HAND_IDS = HAND_IDS
