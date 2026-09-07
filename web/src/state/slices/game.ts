import type { DeckCardEntry, DeckJson, GameEndInfo, GameView } from '../../net/types'
import type { FeedbackPrompt, FeedbackCard } from '../../game/feedback'
import type { PhaseStops } from '../../net/commands'

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
  /** Solicitant (UserRequestMessage.relatedUserId): viaja como `data` en la respuesta (ej. Accept del permiso de mano). */
  relatedUserId?: string
  buttons: UserRequestButton[]
}

/** State for read-only card viewers (VIEW_LIMITED_DECK / VIEW_SIDEBOARD). */
export interface CardViewerState {
  title: string
  cards: FeedbackCard[]
}

/** Open player context menu (right-click on a PlayerInfoBar). */
export interface PlayerMenuState {
  playerId: string
  x: number
  y: number
}

export interface GameSlice {
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
  rollbackDialogOpen: boolean
  viewer: CardViewerState | null
  playerMenu: PlayerMenuState | null
  phaseStops: PhaseStops
  /** Dungeon room progress by `dungeonProgressKey(gameId, dungeon)` (visit order). */
  dungeonProgress: Record<string, string[]>
}

export const initialGame: GameSlice = {
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
  rollbackDialogOpen: false,
  viewer: null,
  playerMenu: null,
  dungeonProgress: {},
  phaseStops: {
    yourTurn: { upkeep: true, draw: true, main1: false, beginCombat: true, endCombat: false, main2: false, endStep: true },
    opponentTurn: { upkeep: true, draw: true, main1: false, beginCombat: true, endCombat: false, main2: false, endStep: true },
  },
}
