import { TABLE } from '../table-names'
/**
 * Scenario for stack-target.spec.ts: the opponent's Lightning Bolt (and an
 * unrelated Giant Growth) sit on the stack while the human holds priority.
 * Clicking Giant Growth makes the server ask (after 800 ms, so a test can switch drawer tabs first) for a spell to counter
 * (GAME_TARGET with only the Bolt as a valid target); clicking the Bolt
 * entry is answered with a GAME_CHOOSE_ABILITY echoing the uuid.
 */

import { makeBaseScenario } from '../fake'
import { makeCard, makeGameView, makePlayer } from '../../src/__fixtures__/gameViews'
import type { GameView } from '../../src/net/types'
import {
  GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID,
} from '../humanGameConstants'

export const STACK_BOLT_ID = 'stack-bolt'
export const STACK_GROWTH_ID = 'stack-growth'

export function stackTargetScenario(): Scenario {
  const getGameView = (): GameView =>
    makeGameView({
      gameCycle: 1,
      turn: 3,
      step: 'PRECOMBAT_MAIN',
      phase: 'PRECOMBAT_MAIN',
      activePlayerId: SIM_PLAYER_ID,
      activePlayerName: SIM_NAME,
      priorityPlayerName: HUMAN_NAME,
      myPlayerId: HUMAN_PLAYER_ID,
      players: [
        makePlayer({ playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, controlled: true, hasPriority: true }),
        makePlayer({ playerId: SIM_PLAYER_ID, name: SIM_NAME, isHuman: false, isActive: true }),
      ],
      stack: {
        [STACK_GROWTH_ID]: makeCard({
          id: STACK_GROWTH_ID,
          name: 'Giant Growth',
          cardTypes: ['INSTANT'],
          manaValue: 1,
          controllerName: SIM_NAME,
        }),
        [STACK_BOLT_ID]: makeCard({
          id: STACK_BOLT_ID,
          name: 'Lightning Bolt',
          cardTypes: ['INSTANT'],
          manaValue: 1,
          controllerName: SIM_NAME,
        }),
      },
    })

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE.stackTarget,
    gameId: GAME_ID,
    getGameView,
    selectMessage: 'Opponent cast Lightning Bolt',
    onSendPlayerUUID: (conn, uuid) => {
      if (uuid === STACK_GROWTH_ID) {
        setTimeout(() => {
          conn.broadcast(
            'GAME_TARGET',
            { message: 'Select a spell to counter', targets: [STACK_BOLT_ID], gameView: getGameView() },
            GAME_ID,
          )
        }, 800)
        return
      }
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
