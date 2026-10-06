import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeckV2 } from './types'
import { addStarterDecks, starterDeckItems, STARTER_DECK_IDS } from './starterDecks'

const stored = vi.hoisted(() => ({ decks: [] as DeckV2[] }))

vi.mock('./storage', () => ({
  getDeckStorage: () => ({ put: async (d: DeckV2) => { stored.decks.push(d) } }),
}))

describe('starter decks', () => {
  beforeEach(() => { stored.decks = [] })

  it('are 60-card decks from the catalog with no sideboard to submit by mistake', () => {
    const items = starterDeckItems()
    expect(items.map((d) => d.id)).toEqual([...STARTER_DECK_IDS])
    for (const d of items) expect(d.cards.reduce((n, c) => n + c.amount, 0)).toBe(60)
  })

  it('are stored as editable copies of their own, not as the catalog entries', async () => {
    const added = await addStarterDecks()
    expect(stored.decks).toEqual(added)
    expect(added.map((d) => d.name)).toEqual(starterDeckItems().map((d) => d.name))
    for (const d of added) {
      expect(d.source).toBe('custom')
      expect(STARTER_DECK_IDS as readonly string[]).not.toContain(d.id)
    }
    expect(new Set(added.map((d) => d.id)).size).toBe(added.length)
  })
})
