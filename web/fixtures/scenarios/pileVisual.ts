import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { FakeConn } from '../fake'
import type { GameView, PlayerView } from '../../src/net/types'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

export function pileVisualScenario(): Scenario {
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

  const card = (id: string, name: string) => ({ id, name, displayName: name })

  const emitPile = () => {
    activeConn?.broadcast('GAME_CHOOSE_PILE', {
      message: 'Separate into two piles',
      cardsView1: { 'p1a': card('p1a', 'Grizzly Bears') },
      cardsView2: { 'p2a': card('p2a', 'Lightning Bolt'), 'p2b': card('p2b', 'Shock') },
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
    tableName: TABLE.pileVisual ?? 'PILE_VISUAL',
    gameId,
    getGameView,
    onConnect: track,
    onStartMatch: (conn) => { track(conn); setTimeout(emitPile, 60) },
    onSendPlayerBoolean: (conn) => { track(conn); finish() },
  })
}
