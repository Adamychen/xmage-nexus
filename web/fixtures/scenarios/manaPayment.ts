import { TABLE } from '../table-names'
import { makeBaseScenario } from '../fake'
import type { FakeConn } from '../fake'
import type { GameView, PlayerView } from '../../src/net/types'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

export const MANA_ACTIONS: string[] = []
export const MANA_TYPES: Array<{ playerId: string; manaType: string }> = []
export const MANA_PREFS: boolean[] = []
export const PHASE_PREFS: unknown[] = []

export function manaPaymentScenario(): Scenario {
  const gameId = GAME_ID
  const tableId = TABLE_ID
  let activeConn: FakeConn | null = null

  const human: PlayerView = {
    playerId: HUMAN_PLAYER_ID, name: HUMAN_NAME, life: 20, controlled: true,
    isHuman: true, hasPriority: true, isActive: true, handCount: 0, libraryCount: 40, battlefield: {},
    manaPool: { red: 2, green: 1, blue: 0, white: 0, black: 0, colorless: 0 },
  }
  const sim: PlayerView = {
    playerId: SIM_PLAYER_ID, name: SIM_NAME, life: 20, controlled: false,
    isHuman: false, hasPriority: false, isActive: false, handCount: 0, libraryCount: 40, battlefield: {},
    manaPool: { red: 0, green: 0, blue: 0, white: 0, black: 0, colorless: 0 },
  }
  const getGameView = (): GameView => ({
    gameId, turn: 1, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN',
    activePlayerId: HUMAN_PLAYER_ID, priorityPlayerId: HUMAN_PLAYER_ID,
    players: [human, sim], myHand: {}, canPlayObjects: { objects: {} },
  })

  const track = (conn: FakeConn) => { activeConn = conn }

  return makeBaseScenario({
    tableId,
    tableName: TABLE.manaPayment ?? 'mana-payment-test',
    gameId,
    getGameView,
    onConnect: track,
    onSendPlayerAction: (conn, value) => {
      track(conn)
      MANA_ACTIONS.push(value)
      activeConn?.broadcast('GAME_UPDATE', { gameView: getGameView() }, gameId)
    },
    onSendPlayerBoolean: (conn) => {
      track(conn)
      activeConn?.broadcast('GAME_UPDATE', { gameView: getGameView() }, gameId)
    },
    onExtra: (conn, action, args, requestId) => {
      if (action === 'updatePreferences') {
        track(conn)
        MANA_PREFS.push(args.confirmEmptyManaPool !== false)
        if (args.phases) PHASE_PREFS.push(args.phases)
        conn.ok(requestId, action, {})
        return true
      }
      if (action !== 'sendPlayerManaType') return false
      track(conn)
      MANA_TYPES.push({ playerId: String(args.playerId ?? ''), manaType: String(args.manaType ?? '') })
      conn.ok(requestId, action, {})
      activeConn?.broadcast('GAME_UPDATE', { gameView: getGameView() }, gameId)
      return true
    },
  })
}
