import type { DraftClientMessage, GameView, TournamentView } from '../../net/types'

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

export interface LimitedSlice {
  draft: DraftState | null
  tournament: TournamentState | null
  construct: ConstructState | null
  replayViewer: { gameView: GameView | null; result?: string } | null
}

export const initialLimited: LimitedSlice = {
  draft: null,
  tournament: null,
  construct: null,
  replayViewer: null,
}
