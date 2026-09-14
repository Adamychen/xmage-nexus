import type { ChatMessageEvent, LobbyEnvelope, TableView } from '../../net/types'
import type { DeepLink } from '../../lobby/deepLink'

export type LogChannel = 'game' | 'chat' | 'system'

export interface LogEntry {
  id: number
  time: number
  from: string
  text: string
  gameId?: string
  channel?: LogChannel
}

export interface LobbySlice {
  lobby: LobbyEnvelope | null
  roomChatId: string | null
  /** chat de la mesa en staging (U4-11); null fuera de la sala de espera */
  tableChatId: string | null
  /** mesa a la que pertenece tableChatId (evita re-joins y cruces al cambiar de mesa) */
  tableChatTableId: string | null
  /** chat del torneo en el panel de partida (T4, paridad con el chatPanel del TournamentPanel) */
  tournamentChatId: string | null
  /** torneo al que pertenece tournamentChatId (evita re-joins y cruces) */
  tournamentChatTournamentId: string | null
  chatMessages: ChatMessageEvent[]
  watchingTable: TableView | null
  /** Resolución tableId→tournamentId del watch de torneo (callback SHOW_TOURNAMENT):
   *  el lobby la usa para abrir el cuadro de un torneo ajeno o en vivo (el server
   *  no acepta el id de mesa en getTournament). */
  spectateTournament: { tournamentId: string; tableId: string } | null
  stagingTableId: string | null
  /** flag isTournament del JOINED_TABLE (el lobby puede ir desfasado al entrar) */
  stagingIsTournament: boolean
  /** invitación pendiente vía deep link (#join= / #watch=); la consume el lobby */
  pendingDeepLink: DeepLink | null
  /** partida que estamos re-uniendo (joinGame) y cuyo replay aún no ha llegado */
  resumingGameId: string | null
  log: LogEntry[]
  events: { method: string; time: number }[]
}

export const initialLobby: LobbySlice = {
  lobby: null,
  roomChatId: null,
  tableChatId: null,
  tableChatTableId: null,
  tournamentChatId: null,
  tournamentChatTournamentId: null,
  chatMessages: [],
  watchingTable: null,
  spectateTournament: null,
  stagingTableId: null,
  stagingIsTournament: false,
  pendingDeepLink: null,
  resumingGameId: null,
  log: [],
  events: [],
}
