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
  chatMessages: ChatMessageEvent[]
  watchingTable: TableView | null
  stagingTableId: string | null
  log: LogEntry[]
  events: { method: string; time: number }[]
}

export const initialLobby: LobbySlice = {
  lobby: null,
  roomChatId: null,
  chatMessages: [],
  watchingTable: null,
  stagingTableId: null,
  log: [],
  events: [],
}
