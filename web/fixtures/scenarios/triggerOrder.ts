import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { FakeConn } from '../fake'
import type { GameView, PlayerView } from '../../src/net/types'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

const TRIGGER_WARDEN = '11111111-1111-1111-1111-111111111111'
const TRIGGER_ARTIST = '22222222-2222-2222-2222-222222222222'

export const TRIGGER_ACTIONS: string[] = []

export function triggerOrderScenario(): Scenario {
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

  const emitPickAbility = () => {
    activeConn?.broadcast('GAME_TARGET', {
      message: 'Pick triggered ability (goes to the stack first)',
      options: { queryType: 'PICK_ABILITY' },
      targets: [TRIGGER_WARDEN, TRIGGER_ARTIST],
      cardsView1: {
        [TRIGGER_WARDEN]: {
          id: TRIGGER_WARDEN, name: 'Soul Warden',
          rules: ['Whenever another creature enters the battlefield, you gain 1 life.'],
        },
        [TRIGGER_ARTIST]: {
          id: TRIGGER_ARTIST, name: 'Blood Artist',
          rules: ['Whenever Blood Artist or another creature dies, target player loses 1 life.'],
        },
      },
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
    tableName: TABLE.triggerOrder ?? 'trigger-order-test',
    gameId,
    getGameView,
    onConnect: track,
    onStartMatch: (conn) => { track(conn); setTimeout(emitPickAbility, 60) },
    onSendPlayerAction: (conn, action) => { track(conn); TRIGGER_ACTIONS.push(action) },
    onSendPlayerUUID: (conn) => { track(conn); finish() },
  })
}
