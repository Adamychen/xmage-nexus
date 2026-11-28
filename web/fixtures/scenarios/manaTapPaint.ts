/**
 * FixtureServer scenario for `tapped-rotation.spec.ts`: paying a cost by clicking lands,
 * which is the flow where a land reached the board drawn straight although the view said it
 * was tapped. Auto-payment is off, so each click is a `sendPlayerUUID` the scenario answers
 * by tapping that land and asking again for the rest of the cost, exactly as the engine does.
 *
 * The board is six lands of two names so a tap regroups them: that regrouping is what moves
 * the card, and the movement is what the board animates.
 */
import { TABLE } from '../table-names'
import { makeBaseScenario, type Scenario } from '../fake'
import { makeGameView, makePermanent, makePlayer } from '../../src/__fixtures__/gameViews'
import type { GameView, PermanentView } from '../../src/net/types'
import { GAME_ID, TABLE_ID, SIM_NAME, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_PLAYER_ID } from '../humanGameConstants'

export const TAP_PAINT_COST = 3

export function manaTapPaintScenario(): Scenario {
  const land = (id: string, name: string, symbol: string): PermanentView =>
    makePermanent({
      id,
      parentId: id,
      name,
      cardTypes: ['Land'],
      subTypes: [name],
      rules: [`{T}: Add ${symbol}.`],
      tapped: false,
    })

  const battlefield: Record<string, PermanentView> = {
    'forest-1': land('forest-1', 'Forest', '{G}'),
    'forest-2': land('forest-2', 'Forest', '{G}'),
    'forest-3': land('forest-3', 'Forest', '{G}'),
    'forest-4': land('forest-4', 'Forest', '{G}'),
    'mountain-1': land('mountain-1', 'Mountain', '{R}'),
    'mountain-2': land('mountain-2', 'Mountain', '{R}'),
  }

  let left = TAP_PAINT_COST

  const getGameView = (): GameView =>
    makeGameView({
      turn: 3,
      phase: 'PRECOMBAT_MAIN',
      step: 'PRECOMBAT_MAIN',
      activePlayerId: HUMAN_PLAYER_ID,
      activePlayerName: HUMAN_NAME,
      priorityPlayerName: HUMAN_NAME,
      myPlayerId: HUMAN_PLAYER_ID,
      players: [
        makePlayer({
          playerId: HUMAN_PLAYER_ID,
          name: HUMAN_NAME,
          controlled: true,
          hasPriority: true,
          isActive: true,
          battlefield: { ...battlefield },
        }),
        makePlayer({ playerId: SIM_PLAYER_ID, name: SIM_NAME, isHuman: false }),
      ],
    })

  const askForMana = (conn: { broadcast: (m: string, d: unknown, g: string) => void }) => {
    conn.broadcast(
      'GAME_PLAY_MANA',
      {
        message: `Pay {${left}} Hydra [7a1]`,
        options: { queryType: 'PLAY_MANA' },
        gameView: getGameView(),
      },
      GAME_ID,
    )
  }

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE.manaTapPaint ?? 'mana-tap-paint-test',
    gameId: GAME_ID,
    getGameView,
    onStartMatch: (conn) => askForMana(conn),
    onSendPlayerUUID: (conn, uuid) => {
      const source = battlefield[uuid]
      if (!source || source.tapped === true) return
      source.tapped = true
      left--
      conn.broadcast('GAME_UPDATE', { gameView: getGameView() }, GAME_ID)
      if (left > 0) {
        askForMana(conn)
      } else {
        conn.broadcast('GAME_SELECT', { message: 'Main 1', gameView: getGameView() }, GAME_ID)
      }
    },
  })
}
