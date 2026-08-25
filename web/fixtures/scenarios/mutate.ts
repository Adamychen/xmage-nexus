import { TABLE } from '../table-names'
import type { Scenario } from '../fake'
import { makeBaseScenario } from '../fake'
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

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE.mutate,
    gameId: GAME_ID,
    gameView,
    onSendPlayerUUID: (conn, uuid) => {
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
          GAME_ID,
        )
      } else {
        conn.broadcast('GAME_UPDATE', { gameView }, GAME_ID)
      }
    },
  })
}
