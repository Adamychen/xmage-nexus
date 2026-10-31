import { TABLE } from '../table-names'

import { makeBaseScenario, type Scenario } from '../fake'
import { makePermanent } from '../../src/__fixtures__/gameViews'
import type { GameView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

export function landFanScenario(): Scenario {
  const land = (id: string, name: string, tapped: boolean) =>
    makePermanent({
      id,
      name,
      cardNumber: '0',
      expansionSetCode: 'TEST',
      cardTypes: ['Land'],
      subTypes: [name],
      superTypes: ['Basic'],
      tapped,
    })

  const battlefield: Record<string, ReturnType<typeof land>> = {}
  for (let i = 1; i <= 3; i++) battlefield[`island-${i}`] = land(`island-${i}`, 'Island', true)
  for (let i = 1; i <= 3; i++) battlefield[`mountain-${i}`] = land(`mountain-${i}`, 'Mountain', false)
  for (let i = 1; i <= 5; i++) battlefield[`forest-${i}`] = land(`forest-${i}`, 'Forest', false)

  const getGameView = (): GameView => {
    const humanPlayer = {
      playerId: HUMAN_PLAYER_ID,
      name: HUMAN_NAME,
      life: 20,
      controlled: true,
      isHuman: true,
      hasPriority: true,
      isActive: true,
      handCount: 0,
      libraryCount: 40,
      battlefield,
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
    } as unknown as PlayerView

    const simPlayer = {
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
    } as unknown as PlayerView

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
      canPlayObjects: {},
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
    tableName: TABLE.landFan,
    gameId: GAME_ID,
    getGameView,
    selectMessage: 'Tablero de tierras — prueba la pila de Forest:',
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
