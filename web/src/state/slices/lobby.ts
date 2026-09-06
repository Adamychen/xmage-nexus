import type { ChatMessageEvent, LobbyEnvelope, TableView } from '../../net/types'

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
  chatMessages: ChatMessageEvent[]
  watchingTable: TableView | null
  stagingTableId: string | null
  /** flag isTournament del JOINED_TABLE (el lobby puede ir desfasado al entrar) */
  stagingIsTournament: boolean
  log: LogEntry[]
  events: { method: string; time: number }[]
}

export const initialLobby: LobbySlice = {
  lobby: null,
  roomChatId: null,
  tableChatId: null,
  tableChatTableId: null,
  chatMessages: [],
  watchingTable: null,
  stagingTableId: null,
  stagingIsTournament: false,
  log: [],
  events: [],
}
