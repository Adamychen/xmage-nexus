import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const scryfallJson = vi.hoisted(() => vi.fn())
vi.mock('../cards/scryfallClient', () => ({ scryfallJson }))

import { useDeckMutations } from './useDeckMutations'
import type { DeckV2 } from './types'

function makeDeck(): DeckV2 {
  return {
    id: 'd1', name: 'Arena import', format: 'Modern', colors: [], createdAt: 0, updatedAt: 0, source: 'imported',
    cards: [{ cardName: 'Lightning Bolt', setCode: '', cardNumber: '', amount: 4 }],
    sideboard: [{ cardName: 'Lightning Bolt', setCode: '', cardNumber: '', amount: 1 }],
  }
}

describe('useDeckMutations handleResolvePrintings', () => {
  it('assigns real printings to printing-less cards and persists', async () => {
    scryfallJson.mockResolvedValue({ object: 'card', name: 'Lightning Bolt', set: 'clu', collector_number: '141', cmc: 1 })
    const schedulePersist = vi.fn()
    const updateMetaForDeck = vi.fn()
    const { result } = renderHook(() => useDeckMutations({
      deck: makeDeck(), schedulePersist, metaMap: new Map(), setMetaMap: vi.fn(), updateMetaForDeck,
      serverFlaggedKeys: new Set<string>(), printingTargetCard: null, setPrintingTargetCard: vi.fn(),
    }))
    await act(async () => { await result.current.handleResolvePrintings() })
    expect(schedulePersist).toHaveBeenCalledTimes(1)
    const next = schedulePersist.mock.calls[0][0] as DeckV2
    expect(next.cards[0]).toMatchObject({ setCode: 'CLU', cardNumber: '141', amount: 4 })
    expect(next.sideboard[0]).toMatchObject({ setCode: 'CLU', cardNumber: '141' })
  })

  it('does nothing when every card already has a printing', async () => {
    scryfallJson.mockReset()
    const deck = makeDeck()
    deck.cards = [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }]
    deck.sideboard = []
    const schedulePersist = vi.fn()
    const { result } = renderHook(() => useDeckMutations({
      deck, schedulePersist, metaMap: new Map(), setMetaMap: vi.fn(), updateMetaForDeck: vi.fn(),
      serverFlaggedKeys: new Set<string>(), printingTargetCard: null, setPrintingTargetCard: vi.fn(),
    }))
    await act(async () => { await result.current.handleResolvePrintings() })
    expect(schedulePersist).not.toHaveBeenCalled()
    expect(scryfallJson).not.toHaveBeenCalled()
  })
})
