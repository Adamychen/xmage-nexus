import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import type { ChatMessageEvent } from '../net/types'
import { isSystemMessage } from '../lobby/chatMessageKind'

export function countUnreadTournamentChat(
  messages: readonly ChatMessageEvent[],
  chatId: string | null | undefined,
  viewer: string | undefined,
  seen: ChatMessageEvent | null,
): number {
  if (!chatId) return 0
  const seenIndex = seen ? messages.indexOf(seen) : -1
  let count = 0
  for (let i = seenIndex + 1; i < messages.length; i++) {
    const m = messages[i]
    if (m.chatId !== chatId) continue
    if (m.username === viewer || isSystemMessage(m)) continue
    count++
  }
  return count
}

function lastOf<T>(list: readonly T[]): T | null {
  return list.length > 0 ? list[list.length - 1] : null
}

export function useTournamentChatUnread(chatId: string | null | undefined, viewer: string | undefined, chatOpen: boolean): number {
  const messages = useStore((s) => s.chatMessages)
  const [seen, setSeen] = useState<ChatMessageEvent | null>(() => lastOf(messages))
  useEffect(() => {
    if (!chatOpen) return
    const last = lastOf(messages)
    if (last !== seen) setSeen(last)
  }, [chatOpen, messages, seen])
  return chatOpen ? 0 : countUnreadTournamentChat(messages, chatId, viewer, seen)
}
