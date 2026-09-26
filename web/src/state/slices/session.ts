import { loadConn } from '../persistence'
import type { ConnectionInfo } from '../persistence'

/** Health of a logged-in session, shown as a banner while it is not `ok`:
 *  `ws-down` the socket to the proxy dropped and reconnects, `relogging` the
 *  socket is back and the session is being restored, `relogin-retry` that
 *  restore failed and is retried, `server-lost` the proxy lost the XMage server
 *  and logs in again on its own. */
export type LinkStatus = 'ok' | 'ws-down' | 'relogging' | 'relogin-retry' | 'server-lost'

export interface SessionSlice {
  phase: 'idle' | 'connecting' | 'lobby' | 'spectating_pending' | 'staging' | 'game'
  conn: ConnectionInfo | null
  wsUrl: string | null
  connecting: boolean
  wsAlive: boolean
  error: string | null
  link: LinkStatus
  linkAttempt: number
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
}
