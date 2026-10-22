import { TABLE } from '../table-names'


import { makeBaseScenario } from '../fake'
import type { Scenario } from '../fake'
import { makePermanent } from '../../src/__fixtures__/gameViews'
import type { GameView, PlayerView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

export function manaStackScenario(): Scenario {
  const land = (id: string, name: string, tapped: boolean) =>
    makePermanent({
      id,
      name,
      cardNumber: '262',
      expansionSetCode: 'TEST',
      cardTypes: ['Land'],
      superTypes: ['Basic'],
      subTypes: [name],
      tapped,
    })

  const rock = (id: string, name: string, isTapped = false) =>
    makePermanent({
      id,
      name,
      cardNumber: '1',
      expansionSetCode: 'TEST',
      cardTypes: ['Artifact'],
      tapped: isTapped,
    })

  const tapped = new Set<string>(['plains-1', 'plains-2', 'plains-3'])

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
        ...Object.fromEntries(
          [0, 1, 2, 3, 4].map((i) => [`plains-${i + 1}`, land(`plains-${i + 1}`, 'Plains', tapped.has(`plains-${i + 1}`))]),
        ),
        'sol-ring': rock('sol-ring', 'Sol Ring', tapped.has('sol-ring')),
        'signet': rock('signet', 'Arcane Signet', tapped.has('signet')),
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
    } as unknown as PlayerView

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
      canPlayObjects: {
        objects: Object.fromEntries(
          ['plains-1', 'plains-2', 'plains-3', 'plains-4', 'plains-5', 'sol-ring', 'signet'].map((id) => [
            id,
            { basicCastAbilities: [{ id, value: 'Tap for mana' }] },
          ]),
        ),
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
    tableName: TABLE.manaStack,
    gameId: GAME_ID,
    getGameView,
    selectMessage: 'Mana permanents stacked',
    onSendPlayerUUID: (conn, uuid) => {
      if (tapped.has(uuid)) tapped.delete(uuid)
      else tapped.add(uuid)
      conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
    },
  })
}
