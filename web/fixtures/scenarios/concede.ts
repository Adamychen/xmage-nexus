import { HumanGame } from './humanGame'
import { GAME_ID, SIM_NAME } from '../humanGameConstants'

/**
 * Escenario mínimo para probar la acción CONCEDE del jugador humano:
 * reutiliza el motor HumanGame (lobby/mesa/arranque ya probados) y, al recibir
 * `sendPlayerAction` con `action: 'CONCEDE'`, emite GAME_OVER (el servidor real
 * termina la partida y el oponente gana).
 */
export function concedeScenario(): ReturnType<HumanGame['scenario']> {
  const game = new HumanGame({
    tableName: 'concede-test',
    lands: [{ name: 'Mountain', count: 7 }],
    hand: ['Mountain', 'Mountain', 'Mountain', 'Mountain'],
    playable: [],
  })
  const base = game.scenario()

  return {
    onConnect: base.onConnect,
    onAction: (conn, action, args, requestId) => {
      if (action === 'sendPlayerAction') {
        const act = (args as { action?: string } | undefined)?.action
        if (act === 'CONCEDE') {
          conn.ok(requestId, action, {})
          conn.broadcast(
            'GAME_OVER',
            { gameId: GAME_ID, winnerName: SIM_NAME, message: 'Mage Web conceded.' },
            GAME_ID,
          )
          conn.broadcast(
            'END_GAME_INFO',
            {
              matchInfo: `${SIM_NAME} won the match!`,
              matchView: { endTime: Date.now(), wins: [{ name: SIM_NAME, wins: 2 }] },
              wins: 0,
              loses: 2,
            },
            GAME_ID,
          )
          return
        }
      }
      base.onAction(conn, action, args, requestId)
    },
  }
}
