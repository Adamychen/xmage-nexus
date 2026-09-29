/**
 * FixtureServer scenario for the History tab (FinishedMatchesPanel):
 * returns a long list of finished matches to verify list scrolling
 * (2026-09-14 regression: the panel overflowed `.lobby-main` with
 * `overflow:hidden` and could not be scrolled).
 */

import type { Scenario } from '../fake'
import type { MatchView } from '../../src/net/types'

const MATCH_COUNT = 14
const MULTIPLAYER_INDEX = 0
const MULTIPLAYER_PLAYERS = ['Ari', 'Bea', 'Cid', 'Dora']
const MULTIPLAYER_RESULT = 'Ari [2-0], Bea [1-1], Cid [1-1], Dora [0-2]'

export function finishedMatches(): MatchView[] {
  const now = Date.now()
  return Array.from({ length: MATCH_COUNT }, (_, i) => {
    const isMultiplayer = i === MULTIPLAYER_INDEX
    return {
      tableId: `hist-table-${i}`,
      matchId: `hist-match-${i}`,
      matchName: `Historial ${i + 1}`,
      gameType: isMultiplayer ? 'Commander' : 'Two Player Duel',
      deckType: isMultiplayer
        ? `Constructed - Commander [hist-${i + 1}]`
        : `Constructed - Freeform [hist-${i + 1}]`,
      games: [],
      result: isMultiplayer ? MULTIPLAYER_RESULT : `player-a-${i} [2-1], player-b-${i} [1-2]`,
      players: isMultiplayer
        ? MULTIPLAYER_PLAYERS.join(', ')
        : `player-a-${i}, player-b-${i}`,
      startTime: now - 1000 * 60 * (30 + i * 10),
      endTime: now - 1000 * 60 * (20 + i * 10),
      rated: i % 2 === 0,
      replayAvailable: false,
    }
  })
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
