import { TABLE } from '../table-names'
/**
 * Escenario del FixtureServer para stack-groups.spec.ts: tablero estático con
 * tokens fungibles para verificar el apilado visual desde ×3.
 *
 * - 4 Treasure enderezados → una pila ×4.
 * - 2 Treasure girados → sueltos (bajo el umbral ×3).
 * - 3 Soldier 1/1 enderezados → una pila ×3.
 * - 1 Soldier 1/1 con contador +1/+1 → suelto (estado divergente).
 * - 1 Grizzly Bears (no token) → suelto.
 *
 * Cualquier click en una carta del campo se responde con un GAME_SELECT que
 * repite el uuid, para probar que el click atraviesa la pila por carta.
 */

import { makeBaseScenario } from '../fake'
import { makePermanent } from '../../src/__fixtures__/gameViews'
import type { GameView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

export function tokensScenario(): Scenario {
  const treasure = (id: string, tapped: boolean) =>
    makePermanent({
      id,
      name: 'Treasure',
      cardNumber: '0',
      expansionSetCode: 'TEST',
      cardTypes: ['Artifact', 'Token'],
      subTypes: ['Treasure'],
      isToken: true,
      tapped,
    })

  const soldier = (id: string, extra: Partial<Parameters<typeof makePermanent>[0]> = {}) =>
    makePermanent({
      id,
      name: 'Soldier',
      cardNumber: '0',
      expansionSetCode: 'TEST',
      cardTypes: ['Creature', 'Token'],
      subTypes: ['Soldier'],
      power: '1',
      toughness: '1',
      isToken: true,
      ...extra,
    })

  const getGameView = (): GameView => {
    const humanPlayer: PlayerView = {
      playerId: HUMAN_PLAYER_ID,
      name: HUMAN_NAME,
      life: 20,
      controlled: true,
      isHuman: true,
      hasPriority: true,
      isActive: true,
      handCount: 0,
      libraryCount: 40,
      battlefield: {
        'treasure-1': treasure('treasure-1', false),
        'treasure-2': treasure('treasure-2', false),
        'treasure-3': treasure('treasure-3', false),
        'treasure-4': treasure('treasure-4', false),
        'treasure-5': treasure('treasure-5', true),
        'treasure-6': treasure('treasure-6', true),
        'soldier-1': soldier('soldier-1'),
        'soldier-2': soldier('soldier-2'),
        'soldier-3': soldier('soldier-3'),
        'soldier-4': soldier('soldier-4', { counters: [{ name: '+1/+1', count: 1 }] }),
        'bears-1': makePermanent({
          id: 'bears-1',
          name: 'Grizzly Bears',
          cardNumber: '19',
          expansionSetCode: '10e',
          cardTypes: ['Creature'],
          subTypes: ['Bear'],
          power: '2',
          toughness: '2',
        }),
      },
      manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
      graveyard: {},
      exile: {},
      sideboard: {},
      helperCards: {},
      topCard: null,
      wins: 0,
      winsNeeded: 2,
      counters: [],
      commandList: [],
      attachments: [],
      hasLeft: false,
      timerActive: false,
      statesSavedSize: 0,
      priorityTimeSavedTimeMs: 0,
    }

    const simPlayer: PlayerView = {
      playerId: SIM_PLAYER_ID,
      name: SIM_NAME,
      life: 20,
      controlled: false,
      isHuman: false,
      hasPriority: false,
      isActive: false,
      handCount: 0,
      libraryCount: 40,
      battlefield: {},
      manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
      graveyard: {},
      exile: {},
      sideboard: {},
      helperCards: {},
      topCard: null,
      wins: 0,
      winsNeeded: 2,
      counters: [],
      commandList: [],
      attachments: [],
      hasLeft: false,
      timerActive: false,
      statesSavedSize: 0,
      priorityTimeSavedTimeMs: 0,
    }

    return {
      gameCycle: 1,
      turn: 3,
      step: 'PRECOMBAT_MAIN',
      phase: 'PRECOMBAT_MAIN',
      special: false,
      rollbackTurnsAllowed: false,
      totalErrorsCount: 0,
      totalEffectsCount: 0,
      priorityTime: 120,
      bufferTime: 0,
      activePlayerId: HUMAN_PLAYER_ID,
      activePlayerName: HUMAN_NAME,
      priorityPlayerName: HUMAN_NAME,
      players: [humanPlayer, simPlayer],
      myPlayerId: HUMAN_PLAYER_ID,
      myHand: {},
      myHelperEmblems: {},
      canPlayObjects: {
        objects: {
          'treasure-2': { basicCastAbilities: [{ id: 'treasure-2', value: 'Activate Treasure' }] },
        },
      },
      opponentHands: {},
      watchedHands: {},
      stack: {},
      exiles: [],
      revealed: [],
      lookedAt: [],
      companion: [],
      combat: [],
    }
  }

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE.tokens,
    gameId: GAME_ID,
    getGameView,
    selectMessage: 'Tablero de tokens — prueba las pilas:',
    onSendPlayerUUID: (conn, uuid) => {
      conn.broadcast(
        'GAME_CHOOSE_ABILITY',
        {
          message: `clicked:${uuid}`,
          choices: [{ id: 'ok', label: 'OK', value: 'ok' }],
          gameView: getGameView(),
        },
        GAME_ID,
      )
    },
  })
}
