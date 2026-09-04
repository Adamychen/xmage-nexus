import { loadConn } from '../persistence'
import type { ConnectionInfo } from '../persistence'

export interface SessionSlice {
  phase: 'idle' | 'connecting' | 'lobby' | 'spectating_pending' | 'staging' | 'game'
  conn: ConnectionInfo | null
  wsUrl: string | null
  connecting: boolean
  wsAlive: boolean
  error: string | null
}

export const initialSession: SessionSlice = {
  phase: 'idle',
  conn: loadConn(),
  wsUrl: null,
  connecting: false,
  wsAlive: false,
  error: null,
}
