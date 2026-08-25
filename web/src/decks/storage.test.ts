import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryStorage } from './storage'
import type { DeckV2 } from './types'

function make(id: string, name: string): DeckV2 {
  return {
    id,
    name,
    cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
    sideboard: [],
    format: 'Freeform',
    colors: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'custom',
  }
}

describe('MemoryDeckStorage', () => {
  let s: ReturnType<typeof createMemoryStorage>
  beforeEach(() => {
    s = createMemoryStorage()
  })
  it('put and list sorts by updatedAt', async () => {
    await s.put(make('1', 'A'))
    await new Promise((r) => setTimeout(r, 2))
    await s.put(make('2', 'B'))
    const all = await s.list()
    expect(all[0].id).toBe('2')
  })
  it('get and del', async () => {
    await s.put(make('1', 'A'))
    expect(await s.get('1')).not.toBeNull()
    await s.del('1')
    expect(await s.get('1')).toBeNull()
  })
  it('count', async () => {
    await s.put(make('1', 'A'))
    await s.put(make('2', 'B'))
    expect(await s.count()).toBe(2)
  })
})
