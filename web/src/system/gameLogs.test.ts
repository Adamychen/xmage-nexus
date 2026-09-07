import { describe, it, expect } from 'vitest'
import {
  GameLogStore,
  createMemoryGameLogBackend,
  buildGameLogHtml,
  toSavedEntries,
  MAX_SAVED_GAME_LOGS,
} from './gameLogs'

const entry = (n: number) => ({ time: 1700000000000 + n * 1000, from: 'servidor', text: `línea <b>${n}</b>` })

describe('GameLogStore', () => {
  it('saves and lists newest-first', async () => {
    const store = new GameLogStore(createMemoryGameLogBackend())
    await store.save({ gameId: 'g1', title: 'one', entries: [entry(1)] })
    await new Promise((r) => setTimeout(r, 2))
    await store.save({ gameId: 'g2', title: 'two', entries: [entry(2)] })
    const list = await store.list()
    expect(list.map((l) => l.title)).toEqual(['two', 'one'])
    expect((await store.getLatest())?.title).toBe('two')
  })

  it('rotates beyond the cap, dropping the oldest', async () => {
    const store = new GameLogStore(createMemoryGameLogBackend())
    for (let i = 0; i < MAX_SAVED_GAME_LOGS + 3; i++) {
      await store.save({ gameId: `g${i}`, title: `t${i}`, entries: [entry(i)] })
      await new Promise((r) => setTimeout(r, 2))
    }
    const list = await store.list()
    expect(list).toHaveLength(MAX_SAVED_GAME_LOGS)
    expect(list.some((l) => l.title === 't0')).toBe(false)
    expect(list[0].title).toBe(`t${MAX_SAVED_GAME_LOGS + 2}`)
  })
})

describe('buildGameLogHtml', () => {
  it('escapes entry text on a black page', () => {
    const html = buildGameLogHtml({
      key: 'k',
      savedAt: 1700000000000,
      gameId: 'g',
      title: 'Partida <x>',
      entries: [entry(1)],
    })
    expect(html).toContain('background:#000')
    expect(html).toContain('Partida &lt;x&gt;')
    expect(html).toContain('línea &lt;b&gt;1&lt;/b&gt;')
    expect(html).not.toContain('<b>1</b>')
  })
})

describe('toSavedEntries', () => {
  it('keeps only time/from/text', () => {
    const out = toSavedEntries([{ id: 1, time: 5, from: 'a', text: 'b', gameId: 'g', channel: 'game' }])
    expect(out).toEqual([{ time: 5, from: 'a', text: 'b' }])
  })
})
