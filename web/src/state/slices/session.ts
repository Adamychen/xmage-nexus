import { loadConn } from '../persistence'
import type { ConnectionInfo } from '../persistence'

/** Health of a logged-in session, shown as a banner while it is not `ok`:
 *  `ws-down` the socket to the proxy dropped and reconnects, `relogging` the
 *  socket is back and the session is being restored, `relogin-retry` that
 *  restore failed and is retried, `server-lost` the proxy lost the XMage server
 *  and logs in again on its own. */
export type LinkStatus = 'ok' | 'ws-down' | 'relogging' | 'relogin-retry' | 'server-lost'

/**
 * Live progress of the automatic login retries after the server refuses with "already
 * connected" (the account's previous session is still alive on the server). `until` is an
 * epoch ms so the connecting splash can count the wait down instead of looking frozen.
 */
export interface LoginRetry {
  attempt: number
  max: number
  until: number
}

export interface SessionSlice {
  phase: 'idle' | 'connecting' | 'lobby' | 'spectating_pending' | 'staging' | 'game'
  conn: ConnectionInfo | null
  wsUrl: string | null
  connecting: boolean
  wsAlive: boolean
  error: string | null
  link: LinkStatus
  linkAttempt: number
  loginRetry: LoginRetry | null
}

export const initialSession: SessionSlice = {
  phase: 'idle',
  conn: loadConn(),
  wsUrl: null,
  connecting: false,
  wsAlive: false,
  error: null,
  link: 'ok',
  linkAttempt: 0,
  loginRetry: null,
}
