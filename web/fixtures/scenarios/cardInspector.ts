import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { Scenario } from '../fake'
import type { GameView, PermanentView, PlayerView } from '../../src/net/types'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

export function cardInspectorScenario(): Scenario {
  const human: PlayerView = {
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
      ring1: {
        id: 'ring1',
        name: 'The One Ring',
        displayName: 'The One Ring',
        expansionSetCode: 'LTR',
        cardNumber: '246',
        cardTypes: ['Artifact'],
        superTypes: ['Legendary'],
        rules: [
          'Indestructible.',
          'When The One Ring enters, you gain protection from everything until your next turn.',
        ],
      } as unknown as PermanentView,
    },
  } as unknown as PlayerView
  const sim: PlayerView = {
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
  } as unknown as PlayerView
  const getGameView = (): GameView => ({
    turn: 1,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID,
    priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim],
    myHand: {},
    canPlayObjects: { objects: {} },
  } as unknown as GameView)

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE.cardInspector,
    gameId: GAME_ID,
    getGameView,
  })
}
