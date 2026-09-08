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
  stagingTableId: string | null
  /** flag isTournament del JOINED_TABLE (el lobby puede ir desfasado al entrar) */
  stagingIsTournament: boolean
  /** invitación pendiente vía deep link (#join= / #watch=); la consume el lobby */
  pendingDeepLink: DeepLink | null
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
  stagingTableId: null,
  stagingIsTournament: false,
  pendingDeepLink: null,
  log: [],
  events: [],
}
