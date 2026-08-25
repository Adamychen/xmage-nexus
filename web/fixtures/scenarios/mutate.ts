import type { Scenario } from '../fake'
import { makeGameView, makePermanent, makePlayer, makeCard } from '../../src/__fixtures__/gameViews'
import { GAME_ID, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_NAME, SIM_PLAYER_ID, TABLE_ID } from '../humanGameConstants'

export function mutateScenario(): Scenario {
  const gameView = makeGameView({
    gameId: GAME_ID,
    turn: 4,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID,
    priorityPlayerId: HUMAN_PLAYER_ID,
    players: [
      makePlayer({
        playerId: HUMAN_PLAYER_ID,
        name: HUMAN_NAME,
        controlled: true,
        isHuman: true,
        life: 20,
        battlefield: {
          land1: makePermanent({
            id: 'land1',
            name: 'Forest',
            parentId: 'land1',
            cardTypes: ['Land'],
          }),
          mutcreature: makePermanent({
            id: 'mutcreature',
            name: 'Sea-Dasher Octopus',
            parentId: 'mutcreature',
            controlled: true,
            cardTypes: ['Creature'],
            power: '3',
            toughness: '3',
            mutated: true,
            mutateView: {
              'mut-under-1': {
                id: 'mut-under-1',
                name: 'Gemrazer',
                manaValue: 4,
                expansionSetCode: 'IKO',
                cardNumber: '155',
                cardTypes: ['Creature'],
                power: '4',
                toughness: '4',
              },
              'mut-under-2': {
                id: 'mut-under-2',
                name: 'Pouncing Shoreshark',
                manaValue: 4,
                expansionSetCode: 'IKO',
                cardNumber: '64',
                cardTypes: ['Creature'],
                power: '3',
                toughness: '4',
              },
            },
          } as any),
        },
      }),
      makePlayer({
        playerId: SIM_PLAYER_ID,
        name: SIM_NAME,
        controlled: false,
        isHuman: false,
        life: 20,
        handCount: 1,
        battlefield: {
          oppLand1: makePermanent({
            id: 'oppLand1',
            name: 'Island',
            parentId: 'oppLand1',
            cardTypes: ['Land'],
          }),
          oppMut: makePermanent({
            id: 'oppMut',
            name: 'Leyline Predator',
            parentId: 'oppMut',
            cardTypes: ['Creature'],
            power: '4',
            toughness: '5',
            mutated: true,
            mutateView: {
              'opp-under-1': {
                id: 'opp-under-1',
                name: 'Migratory Greathorn',
                manaValue: 5,
                expansionSetCode: 'IKO',
                cardNumber: '140',
                cardTypes: ['Creature'],
                power: '4',
                toughness: '4',
              },
            },
          } as any),
        },
      }),
    ],
    revealed: [],
    canPlayObjects: {
      objects: {
        mutcreature: {
          basicPlayAbilities: [
            { id: 'mutcreature', value: 'Activate: +1/+1 and draw (Mutate)' },
          ],
        },
      },
    },
  })

  const table = {
    tableId: TABLE_ID,
    tableName: 'Mutate Showcase',
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
          conn.broadcast('START_GAME', { gameId: GAME_ID, tableName: 'Mutate Showcase' }, GAME_ID)
          conn.broadcast('GAME_INIT', { gameView }, GAME_ID)
          conn.broadcast(
            'GAME_SELECT',
            {
              message: 'Main 1: Cast spells or activate abilities',
              options: { specialButton: 'Pass' },
              gameView,
            },
            GAME_ID,
          )
          break
        case 'sendPlayerUUID': {
          conn.ok(requestId, action, {})
          const uuid = String((args as any)?.value ?? (args as any)?.uuid ?? (args as any)?.[0] ?? '')
          // Clicking the mutated creature opens its ability choice (GAME_CHOOSE_ABILITY)
          if (uuid === 'mutcreature') {
            conn.broadcast(
              'GAME_CHOOSE_ABILITY',
              {
                message: 'Elige una habilidad de Sea-Dasher Octopus (Mutado):',
                choices: [
                  { id: 'mut-ability', label: 'Habilidad de Mutar: +1/+1 y roba una carta', value: 'mut-ability' },
                ],
                gameView,
              },
              GAME_ID
            )
          } else {
            conn.broadcast('GAME_UPDATE', { gameView }, GAME_ID)
          }
          break
        }
        case 'sendPlayerAction':
        case 'sendPlayerBoolean':
        case 'sendPlayerInteger':
        case 'sendPlayerString':
          conn.ok(requestId, action, {})
          conn.broadcast('GAME_UPDATE', { gameView }, GAME_ID)
          break
        default:
          conn.ok(requestId, action, undefined)
          break
      }
    },
  }
}
