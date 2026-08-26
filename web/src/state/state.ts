import type { ChatMessageEvent, DeckCardEntry, DeckJson, DraftClientMessage, GameEndInfo, GameView, LobbyEnvelope, TableView, TournamentView } from '../net/types'
import type { FeedbackPrompt, FeedbackCard } from '../game/feedback'
import type { PhaseStops } from '../net/commands'
import { loadConn, type ConnectionInfo } from './persistence'

export type LogChannel = 'game' | 'chat' | 'system'

export interface LogEntry {
  id: number
  time: number
  from: string
  text: string
  gameId?: string
  channel?: LogChannel
}

export interface CombatState {
  mode: 'attack' | 'block'
  selectable: string[]
  special: boolean
  chosen: string[]
}

/** A card in the sideboard screen (instance ID + resolved Scryfall data). */
export interface SideboardCard {
  instanceId: string
  setCode: string
  cardNumber: string
  name: string
}

/** State for the sideboard screen (between games in Bo3). */
export interface SideboardScreenState {
  deckName: string
  maindeck: SideboardCard[]
  sideboard: SideboardCard[]
  tableId: string
  parentTableId: string | null
  timeLeft: number
  limited: boolean
}

/** A button of a generic server request dialog (USER_REQUEST_DIALOG). */
export interface UserRequestButton {
  text: string
  action: string
}

/** State for the generic user-request dialog (server-driven buttons → PlayerAction). */
export interface UserRequestView {
  title: string
  message: string
  gameId?: string
  buttons: UserRequestButton[]
}

/** State for read-only card viewers (VIEW_LIMITED_DECK / VIEW_SIDEBOARD). */
export interface CardViewerState {
  title: string
  cards: FeedbackCard[]
}

/** Draft state (START_DRAFT / DRAFT_INIT / DRAFT_PICK / DRAFT_UPDATE / DRAFT_OVER). */
export interface DraftState {
  draftId: string
  message: DraftClientMessage
  timeLeft?: number
}

/** Tournament snapshot (TOURNAMENT_INIT / TOURNAMENT_UPDATE). */
export interface TournamentState {
  tournamentId: string
  view: TournamentView
}

/** Limited construct (CONSTRUCT) — pool deckbuilding between draft and matches. */
export interface ConstructState {
  deckName: string
  pool: Record<string, unknown>
  tableId: string
  parentTableId: string | null
  timeLeft: number
}

export interface AppState {
  phase: 'idle' | 'connecting' | 'lobby' | 'spectating_pending' | 'game'
  conn: ConnectionInfo | null
  wsUrl: string | null
  connecting: boolean
  wsAlive: boolean
  lobby: LobbyEnvelope | null
  roomChatId: string | null
  chatMessages: ChatMessageEvent[]
  watchingTable: TableView | null
  game: GameView | null
  gameId: string | null
  gameChatId: string | null
  playableIds: string[]
  playableWindow: { turn: number; phase: string } | null
  combat: CombatState | null
  gameEnd: GameEndInfo | null
  myDeck: DeckJson | null
  feedback: FeedbackPrompt | null
  sideboard: DeckCardEntry[]
  sideboardScreen: SideboardScreenState | null
  userRequest: UserRequestView | null
  viewer: CardViewerState | null
  draft: DraftState | null
  tournament: TournamentState | null
  construct: ConstructState | null
  replayViewer: { gameView: GameView | null; result?: string } | null
  phaseStops: PhaseStops
  log: LogEntry[]
  events: { method: string; time: number }[]
  settings: {
    autoKeepMulligan: boolean
    autoPass: boolean
    holdPriority: boolean
    boardLayout: 'standard' | 'pod'
  }
  error: string | null
}

export const initialState: AppState = {
  phase: 'idle',
  conn: loadConn(),
  wsUrl: null,
  connecting: false,
  wsAlive: false,
  lobby: null,
  roomChatId: null,
  chatMessages: [],
  watchingTable: null,
  game: null,
  gameId: null,
  gameChatId: null,
  playableIds: [],
  playableWindow: null,
  combat: null,
  gameEnd: null,
  myDeck: null,
  feedback: null,
  sideboard: [],
  sideboardScreen: null,
  userRequest: null,
  viewer: null,
  draft: null,
  tournament: null,
  construct: null,
  replayViewer: null,
  phaseStops: {
    yourTurn: { upkeep: true, draw: true, main1: false, beginCombat: true, endCombat: false, main2: false, endStep: true },
    opponentTurn: { upkeep: true, draw: true, main1: false, beginCombat: true, endCombat: false, main2: false, endStep: true },
  },
  log: [],
  events: [],
  settings: { autoKeepMulligan: false, autoPass: false, holdPriority: false, boardLayout: 'standard' },
  error: null,
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
