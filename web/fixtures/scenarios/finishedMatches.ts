/**
 * Escenario del FixtureServer para el Historial (FinishedMatchesPanel):
 * devuelve una lista larga de partidas terminadas para poder verificar el
 * scroll de la lista (regresión 2026-09-14: el panel desbordaba el
 * `.lobby-main` con `overflow:hidden` y no se podía desplazar).
 */

import type { Scenario } from '../fake'
import type { MatchView } from '../../src/net/types'

const MATCH_COUNT = 14

export function finishedMatches(): MatchView[] {
  const now = Date.now()
  return Array.from({ length: MATCH_COUNT }, (_, i) => ({
    tableId: `hist-table-${i}`,
    matchId: `hist-match-${i}`,
    matchName: `Historial ${i + 1}`,
    gameType: 'Two Player Duel',
    deckType: `Constructed - Freeform [hist-${i + 1}]`,
    games: [],
    result: `player-a-${i} [2-1], player-b-${i} [1-2]`,
    players: `player-a-${i}, player-b-${i}`,
    startTime: now - 1000 * 60 * (30 + i * 10),
    endTime: now - 1000 * 60 * (20 + i * 10),
    rated: i % 2 === 0,
    replayAvailable: false,
  }))
}

export function finishedMatchesScenario(): Scenario {
  return {
    onConnect(conn) {
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
    },
    onStart(conn) {
      conn.lobby([])
      const timer = setInterval(() => conn.lobby([]), 2000)
      return () => clearInterval(timer)
    },
    onAction(conn, action, args, requestId) {
      switch (action) {
        case 'connect':
          conn.ok(requestId, action, {})
          break
        case 'getFinishedMatches':
          conn.ok(requestId, action, finishedMatches())
          break
        case 'getRoomChatId':
          conn.ok(requestId, action, 'room-chat-hist')
          break
        default:
          conn.ok(requestId, action, {})
          break
      }
      void args
    },
  }
}
