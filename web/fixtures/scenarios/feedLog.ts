import type { FakeConn, Scenario } from '../fake'
import { replayRecordedScenario, REPLAY_TABLE_NAME } from './replay-recorded'

export const FEED_BURST_LINES = 60
export const FEED_EMIT_PREFIX = 'emit '

export function feedLogScenario(): Scenario {
  let gameId = ''

  const emitLogLine = (conn: FakeConn, message: string) => {
    conn.broadcast(
      'CHATMESSAGE',
      { chatId: `game-chat-${gameId}`, username: '', message, messageType: 'GAME', time: Date.now() },
      gameId,
    )
  }

  return replayRecordedScenario('illegal-target.json', REPLAY_TABLE_NAME, {
    onStartMatch: (conn, id) => {
      gameId = id
      for (let i = 1; i <= FEED_BURST_LINES; i++) emitLogLine(conn, `Log line ${i}`)
    },
    onRequest: (conn, action, args, requestId) => {
      const text = String(args.text ?? '')
      if (action !== 'sendChatMessage' || !text.startsWith(FEED_EMIT_PREFIX)) return false
      conn.ok(requestId, action, true)
      emitLogLine(conn, text.slice(FEED_EMIT_PREFIX.length))
      return true
    },
  })
}
