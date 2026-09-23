import { describe, expect, it } from 'vitest'
import {
  MAX_MATCH_RECORDS,
  MatchHistoryStore,
  computeStats,
  createMemoryMatchHistoryBackend,
  type MatchRecord,
} from './matchHistory'

const base = (over: Partial<Omit<MatchRecord, 'id'>> = {}): Omit<MatchRecord, 'id'> => ({
  endedAt: 1,
  gameId: 'aaaaaaaa-1111',
  deckName: 'Burn',
  format: 'Constructed - Modern',
  opponents: ['Bob'],
  result: 'win',
  turns: 6,
  life: 12,
  ...over,
})

describe('MatchHistoryStore', () => {
  it('lists newest first', async () => {
    const store = new MatchHistoryStore(createMemoryMatchHistoryBackend())
    await store.add(base({ endedAt: 10, gameId: 'g1xxxxxx' }))
    await store.add(base({ endedAt: 30, gameId: 'g3xxxxxx' }))
    await store.add(base({ endedAt: 20, gameId: 'g2xxxxxx' }))
    expect((await store.list()).map((r) => r.endedAt)).toEqual([30, 20, 10])
  })

  it('ignores a second record for the same game', async () => {
    const store = new MatchHistoryStore(createMemoryMatchHistoryBackend())
    expect(await store.add(base({ endedAt: 1 }))).not.toBeNull()
    expect(await store.add(base({ endedAt: 2 }))).toBeNull()
    expect(await store.list()).toHaveLength(1)
  })

  it('keeps only the newest records', async () => {
    const store = new MatchHistoryStore(createMemoryMatchHistoryBackend())
    for (let i = 0; i < MAX_MATCH_RECORDS + 3; i++) {
      await store.add(base({ endedAt: 1_000_000 + i, gameId: `game${String(i).padStart(4, '0')}-x` }))
    }
    const list = await store.list()
    expect(list).toHaveLength(MAX_MATCH_RECORDS)
    expect(list[list.length - 1].endedAt).toBe(1_000_003)
  })

  it('clears everything', async () => {
    const store = new MatchHistoryStore(createMemoryMatchHistoryBackend())
    await store.add(base())
    await store.clear()
    expect(await store.list()).toEqual([])
  })
})

describe('computeStats', () => {
  const rec = (over: Partial<MatchRecord>): MatchRecord => ({ id: 'x', ...base(), ...over })

  it('tallies overall and per deck / format / opponent', () => {
    const stats = computeStats([
      rec({ result: 'win', deckName: 'Burn', opponents: ['Bob'] }),
      rec({ result: 'loss', deckName: 'Burn', opponents: ['Bob'] }),
      rec({ result: 'win', deckName: 'Elves', format: 'Commander', opponents: ['Cy', 'Di'] }),
    ])
    expect(stats.overall).toEqual({ games: 3, wins: 2, losses: 1, winRate: 2 / 3 })
    expect(stats.byDeck.map((r) => [r.key, r.games, r.wins])).toEqual([['Burn', 2, 1], ['Elves', 1, 1]])
    expect(stats.byFormat.map((r) => r.key).sort()).toEqual(['Commander', 'Constructed - Modern'])
    expect(stats.byOpponent.map((r) => r.key)).toEqual(['Bob', 'Cy', 'Di'])
  })

  it('skips missing deck and format, and handles an empty history', () => {
    const stats = computeStats([rec({ deckName: null, format: null })])
    expect(stats.byDeck).toEqual([])
    expect(stats.byFormat).toEqual([])
    expect(computeStats([]).overall).toEqual({ games: 0, wins: 0, losses: 0, winRate: 0 })
  })
})
