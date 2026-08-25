import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { FakeConn } from '../fake'
import type { GameView, PlayerView } from '../../src/net/types'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

export function votingScenario(): Scenario {
  const gameId = GAME_ID
  const tableId = TABLE_ID
  let activeConn: FakeConn | null = null

  const human: PlayerView = {
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, life: 20, controlled: true,
    isHuman: true, hasPriority: true, isActive: true, handCount: 0, libraryCount: 40, battlefield: {},
  }
  const sim: PlayerView = {
    playerId: SIM_PLAYER_ID, name: SIM_NAME, life: 20, controlled: false,
    isHuman: false, hasPriority: false, isActive: false, handCount: 0, libraryCount: 40, battlefield: {},
  }
  const getGameView = (): GameView => ({
    gameId, turn: 1, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID, priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim], myHand: {}, canPlayObjects: { objects: {} },
  })

  const emitVoting = () => {
    activeConn?.broadcast('GAME_ASK', {
      message: 'Vote, step 1 of 2 — choose Strength or Numbers',
      options: { strength: 'Strength', numbers: 'Numbers' },
      gameView: getGameView(),
    }, gameId)
  }

  const finish = () => {
    activeConn?.broadcast('GAME_UPDATE', { gameView: getGameView() }, gameId)
    activeConn?.broadcast('GAME_SELECT', { message: 'Priority', gameView: getGameView() }, gameId)
  }

  const track = (conn: FakeConn) => { activeConn = conn }

  return makeBaseScenario({
    tableId,
    tableName: TABLE.voting ?? 'VOTING',
    gameId,
    getGameView,
    onConnect: track,
    onStartMatch: (conn) => { track(conn); setTimeout(emitVoting, 60) },
    onSendPlayerBoolean: (conn) => { track(conn); finish() },
    onSendPlayerString: (conn) => { track(conn); finish() },
  })
}
