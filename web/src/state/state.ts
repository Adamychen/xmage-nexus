import type { SessionSlice } from './slices/session'
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
  listeners.forEach((l) => l())
}

export function getState(): AppState {
  return _state
}

export function addLog(from: string, text: string, gameId?: string, channel?: LogChannel) {
  const ch: LogChannel = channel ?? (from === 'partida' ? 'game' : 'system')
  setState({ log: [..._state.log, { id: ++logSeq, time: Date.now(), from, text, gameId, channel: ch }].slice(-300) })
}

export { listeners }
