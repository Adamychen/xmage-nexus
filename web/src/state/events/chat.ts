import type { ChatMessageEvent } from '../../net/types'
import { parseGameEvent } from '../../game/gameEventParser'
import { setState, addLog } from '../state'
import { soundManager } from '../../audio/soundManager'
import type { Snapshot } from './context'

export function handleChatMessage(data: unknown, objectId: string | null, s: Snapshot): void {
  const m = data as ChatMessageEvent
  if (m.soundToPlay === 'PlayerWhispered') {
    soundManager.play('whisper', 'ui')
  } else if (m.soundToPlay === 'PlayerLeft') {
    soundManager.play('ui_click', 'ui')
  }
  if (s.phase !== 'game' && m.chatId && s.roomChatId && m.chatId !== s.roomChatId) {
    return
  }
  if (s.phase === 'game' && m.chatId && s.gameChatId && s.roomChatId && m.chatId !== s.gameChatId && m.chatId !== s.roomChatId) {
    return
  }
  setState({ chatMessages: [...s.chatMessages, m].slice(-300) })
  const mt = m.messageType
  let channel: 'game' | 'chat' | 'system'
  if (mt === 'GAME') channel = 'game'
  else if (mt === 'TALK') channel = 'chat'
  else if (mt) channel = 'system'
  else channel = parseGameEvent(m.message) ? 'game' : (m.username ? 'chat' : 'system')
  addLog(m.username, m.message, objectId ?? undefined, channel)
}

export function handleShowUserMessage(data: unknown): void {
  const d = data as { title?: string; message?: string } | string | null
  const text = typeof d === 'string' ? d : (d?.message ?? d?.title ?? JSON.stringify(d))
  if (text) {
    setState({ error: text })
    addLog('servidor', text)
  }
}

export function handleServerMessage(data: unknown): void {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  addLog('servidor', text)
}
