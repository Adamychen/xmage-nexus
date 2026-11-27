import type { SessionSlice } from './slices/session'
import { noteGameForArt } from '../cards/foreignCards'
import { initialSession } from './slices/session'
import type { LobbySlice, LogChannel } from './slices/lobby'
import { initialLobby } from './slices/lobby'
import type { GameSlice } from './slices/game'
import { initialGame } from './slices/game'
import type { LimitedSlice } from './slices/limited'
import { initialLimited } from './slices/limited'
import type { SettingsSlice } from './slices/settings'
import { initialSettings } from './slices/settings'

export type {
  SessionSlice,
  LogChannel, LogEntry, LobbySlice,
  CombatState, SideboardCard, SideboardScreenState, UserRequestButton,
  UserRequestView, CardViewerState, GameSlice,
  DraftState, TournamentState, ConstructState, LimitedSlice,
  SettingsState, SettingsSlice,
} from './slices'

export interface AppState extends SessionSlice, LobbySlice, GameSlice, LimitedSlice, SettingsSlice {}

export const initialState: AppState = {
  ...initialSession,
  ...initialLobby,
  ...initialGame,
  ...initialLimited,
  ...initialSettings,
}

let _state: AppState = initialState
const listeners = new Set<() => void>()
let logSeq = 0

export function setState(partial: Partial<AppState>) {
  _state = { ..._state, ...partial }
  if ('game' in partial) noteGameForArt(_state.game)
  listeners.forEach((l) => l())
}

export function getState(): AppState {
  return _state
}

export const LOG_CAP = 300
export const CHAT_KEEP = 100

/**
 * PNL-14: the log is capped, and the chat lives in the same list. A turn of a crowded game writes
 * dozens of engine lines, so a flat cap threw away what people had said to each other. The cap is
 * spent on the game's own lines first: a chat line is only dropped once more than `CHAT_KEEP` of
 * them are held, which is far more than anybody scrolls back through.
 */
export function trimLog<T extends { channel?: LogChannel }>(entries: T[]): T[] {
  if (entries.length <= LOG_CAP) return entries
  let excess = entries.length - LOG_CAP
  let chatDroppable = Math.max(0, entries.reduce((n, e) => n + (e.channel === 'chat' ? 1 : 0), 0) - CHAT_KEEP)
  const out: T[] = []
  for (const entry of entries) {
    if (excess > 0) {
      if (entry.channel !== 'chat') {
        excess -= 1
        continue
      }
      if (chatDroppable > 0) {
        chatDroppable -= 1
        excess -= 1
        continue
      }
    }
    out.push(entry)
  }
  return out
}

export function addLog(from: string, text: string, gameId?: string, channel?: LogChannel, fromRoom?: boolean) {
  const ch: LogChannel = channel ?? (from === 'partida' ? 'game' : 'system')
  setState({ log: trimLog([..._state.log, { id: ++logSeq, time: Date.now(), from, text, gameId, channel: ch, ...(fromRoom ? { fromRoom } : {}) }]) })
}

export { listeners }
