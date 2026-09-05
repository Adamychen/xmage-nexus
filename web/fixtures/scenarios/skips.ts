import { TABLE } from '../table-names'
import { makeBaseScenario, type Scenario } from '../fake'
import { makeGameView, makePlayer } from '../../src/__fixtures__/gameViews'

const GAME_ID = 'game-skips-1'

const FLAG_FOR_ACTION: Record<string, string> = {
  PASS_PRIORITY_UNTIL_NEXT_TURN: 'passedTurn',
  PASS_PRIORITY_UNTIL_TURN_END_STEP: 'passedUntilEndOfTurn',
  PASS_PRIORITY_UNTIL_NEXT_MAIN_PHASE: 'passedUntilNextMain',
  PASS_PRIORITY_UNTIL_MY_NEXT_TURN: 'passedAllTurns',
  PASS_PRIORITY_UNTIL_STACK_RESOLVED: 'passedUntilStackResolved',
  PASS_PRIORITY_UNTIL_END_STEP_BEFORE_MY_NEXT_TURN: 'passedUntilEndStepBeforeMyTurn',
}

/**
 * Escenario para los skips one-shot estilo desktop (F4/F5/F7/F9/F10/F11 + F3):
 * partida mínima con prioridad humana donde `sendPlayerAction(PASS_PRIORITY_*)`
 * activa el flag `passed*` correspondiente en el jugador — como hace el servidor
 * real (los flags viajan en el PlayerView y el cliente los lee para marcar el
 * skip activo). F3 (`PASS_PRIORITY_CANCEL_ALL_ACTIONS`) los limpia todos.
 */
export function skipsScenario(): Scenario {
  const human = makePlayer({
    playerId: 'human-1',
    name: 'Mage Web',
    controlled: true,
    isHuman: true,
    isActive: true,
    hasPriority: true,
    life: 20,
  })
  const sim = makePlayer({
    playerId: 'sim-1',
    name: 'Sim',
    controlled: false,
    isHuman: false,
    life: 20,
  })
  const view = makeGameView({
    players: [human, sim],
    myPlayerId: 'human-1',
    activePlayerId: 'human-1',
    activePlayerName: 'Mage Web',
    priorityPlayerName: 'Mage Web',
    phase: 'MAIN',
    step: 'PRECOMBAT_MAIN',
    turn: 3,
  })

  const setFlag = (flag: string | null) => {
    for (const f of Object.values(FLAG_FOR_ACTION)) {
      ;(human as unknown as Record<string, unknown>)[f] = f === flag
    }
  }

  return makeBaseScenario({
    tableId: 'table-skips-1',
    tableName: TABLE.skips,
    gameId: GAME_ID,
    getGameView: () => view,
    onSendPlayerAction: (conn, value) => {
      if (value === 'PASS_PRIORITY_CANCEL_ALL_ACTIONS') {
        setFlag(null)
        conn.broadcast('GAME_UPDATE', { gameView: view }, GAME_ID)
        return
      }
      if (value in FLAG_FOR_ACTION) {
        setFlag(FLAG_FOR_ACTION[value]!)
        conn.broadcast('GAME_UPDATE', { gameView: view }, GAME_ID)
      }
    },
  })
}
