import { describe, it, expect } from 'vitest'
import { CHAT_KEEP, LOG_CAP, trimLog } from './state'

type Entry = { id: number; channel: 'game' | 'chat' | 'system' }

const lines = (n: number, channel: Entry['channel'], from = 0): Entry[] =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, channel }))

describe('PNL-14: a game that talks a lot does not wipe what the players said', () => {
  it('PNL-14: a flood of engine lines keeps every chat line that came before it', () => {
    const chat = lines(3, 'chat')
    const kept = trimLog([...chat, ...lines(LOG_CAP * 2, 'game', 100)])
    expect(kept.filter((e) => e.channel === 'chat')).toEqual(chat)
  })

  it('PNL-14: the engine lines that survive are the most recent ones', () => {
    const kept = trimLog([...lines(2, 'chat'), ...lines(LOG_CAP + 50, 'game', 100)])
    const game = kept.filter((e) => e.channel === 'game')
    expect(game.length).toBe(LOG_CAP - 2)
    expect(game[game.length - 1].id).toBe(100 + LOG_CAP + 49)
  })

  it('PNL-14: chat itself is still bounded, so a flood of messages cannot grow without end', () => {
    const kept = trimLog(lines(LOG_CAP * 3, 'chat'))
    expect(kept.length).toBeLessThanOrEqual(LOG_CAP + CHAT_KEEP)
    expect(kept[kept.length - 1].id).toBe(LOG_CAP * 3 - 1)
  })

  it('PNL-14: a log under the cap is left exactly as it is', () => {
    const entries = lines(LOG_CAP, 'game')
    expect(trimLog(entries)).toEqual(entries)
  })
})
