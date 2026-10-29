import { describe, expect, it } from 'vitest'
import { countUnreadTournamentChat } from './tournamentChatUnread'
import type { ChatMessageEvent } from '../net/types'

const CHAT = 'tournament-chat'
const OTHER = 'room-chat'

function talk(username: string, message = 'hi', chatId = CHAT): ChatMessageEvent {
  return { chatId, username, message, messageType: 'TALK' }
}

function system(message: string, chatId = CHAT): ChatMessageEvent {
  return { chatId, username: '', message, messageType: 'SYSTEM' }
}

function capped(list: ChatMessageEvent[]): ChatMessageEvent[] {
  return list.slice(-300)
}

describe('TRN-20 · countUnreadTournamentChat', () => {
  it('TRN-20: counts only the tournament chat messages after the last one seen', () => {
    const a = talk('bob')
    const b = talk('carol')
    const list = [a, talk('dave', 'before', OTHER), b, talk('erin'), talk('frank', 'x', OTHER)]
    expect(countUnreadTournamentChat(list, CHAT, 'zoe', a)).toBe(2)
    expect(countUnreadTournamentChat(list, CHAT, 'zoe', b)).toBe(1)
  })

  it('TRN-20: with nothing seen yet every tournament chat message in the list counts', () => {
    const list = [talk('bob'), talk('carol', 'x', OTHER), talk('erin')]
    expect(countUnreadTournamentChat(list, CHAT, 'zoe', null)).toBe(2)
  })

  it('TRN-20: ignores the viewer\'s own messages', () => {
    const seen = talk('bob')
    const list = [seen, talk('zoe'), talk('carol'), talk('zoe', 'again')]
    expect(countUnreadTournamentChat(list, CHAT, 'zoe', seen)).toBe(1)
  })

  it('TRN-20: ignores system lines such as joins, leaves and server notices', () => {
    const seen = talk('bob')
    const list = [
      seen,
      system('carol has joined the chat'),
      { chatId: CHAT, username: 'server', message: 'Round 2 starts', messageType: 'TALK' } as ChatMessageEvent,
      { chatId: CHAT, username: 'dave', message: 'x', messageType: 'STATUS' } as ChatMessageEvent,
      talk('erin', '[NEXUS_READY] erin'),
      talk('frank', 'real question'),
    ]
    expect(countUnreadTournamentChat(list, CHAT, 'zoe', seen)).toBe(1)
  })

  it('TRN-20: keeps counting correctly when the list is capped at 300 and old messages fall off', () => {
    const seen = talk('bob', 'anchor')
    const full = [seen, ...Array.from({ length: 299 }, (_, i) => talk('carol', `m${i}`))]
    expect(full.length).toBe(300)
    const grown = capped([...full, talk('dave', 'new 1'), talk('erin', 'new 2'), talk('frank', 'new 3')])
    expect(grown.length).toBe(300)
    expect(grown.indexOf(seen)).toBe(-1)
    expect(countUnreadTournamentChat(grown, CHAT, 'zoe', seen)).toBe(300)
  })

  it('TRN-20: a full capped list still counts only the messages after the anchor', () => {
    const filler = Array.from({ length: 299 }, (_, i) => talk('carol', `m${i}`))
    const seen = talk('bob', 'anchor')
    const list = capped([...filler, seen, talk('dave', 'after 1'), talk('erin', 'after 2')])
    expect(list.length).toBe(300)
    expect(countUnreadTournamentChat(list, CHAT, 'zoe', seen)).toBe(2)
    const later = capped([...list, talk('frank', 'after 3'), talk('erin', 'after 4')])
    expect(later.length).toBe(300)
    expect(countUnreadTournamentChat(later, CHAT, 'zoe', seen)).toBe(4)
  })

  it('TRN-20: returns zero when there is no tournament chat', () => {
    const list = [talk('bob')]
    expect(countUnreadTournamentChat(list, null, 'zoe', null)).toBe(0)
    expect(countUnreadTournamentChat(list, undefined, 'zoe', null)).toBe(0)
  })

  it('TRN-20: returns zero when the last seen message is the newest one, so an open chat clears the count', () => {
    const list = [talk('bob'), talk('carol')]
    expect(countUnreadTournamentChat(list, CHAT, 'zoe', list[list.length - 1])).toBe(0)
  })
})
