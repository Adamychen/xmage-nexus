import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { FakeConn } from '../fake'
import type { GameView, PlayerView } from '../../src/net/types'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

export function planeswalkerScenario(): Scenario {
  const gameId = GAME_ID
  const tableId = TABLE_ID
  let activeConn: FakeConn | null = null

  const human: PlayerView = {
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, life: 20, controlled: true,
    isHuman: true, hasPriority: true, isActive: true, handCount: 0, libraryCount: 40,
    battlefield: { pw1: { id: 'pw1', name: 'Jace, the Mind Sculptor', cardTypes: ['Planeswalker'], loyalty: '3' } as unknown as Record<string, unknown> },
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

  const emitPW = () => {
    activeConn?.broadcast('GAME_CHOOSE_ABILITY', {
      message: 'Activate a loyalty ability of Jace, the Mind Sculptor',
      choices: { a1: '+2: Look at the top card', a2: '-3: Draw two cards', a3: '-8: Take an extra turn' },
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
    tableName: TABLE.planeswalker ?? 'PLANESWALKER',
    gameId,
    getGameView,
    onConnect: track,
    onStartMatch: (conn) => { track(conn); emitPW() },
    onSendPlayerUUID: (conn) => { track(conn); finish() },
  })
}
