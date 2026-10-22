import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

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

describe('useDeckMutations resolves the deck that was just imported', () => {
  const scryfallFor = (names: Record<string, { set: string; collector_number: string }>) =>
    scryfallJson.mockImplementation(async (url: string) => {
      const hit = Object.keys(names).find((n) => url.includes(n.split(' ')[0].replace(',', ''))) 
      return hit ? { object: 'card', name: hit, cmc: 1, ...names[hit] } : null
    })

  const oldDeck = (): DeckV2 => ({
    id: 'd1', name: 'Arena import', format: 'Commander', colors: [], createdAt: 0, updatedAt: 0, source: 'imported',
    cards: [{ cardName: 'Forest', setCode: 'M21', cardNumber: '265', amount: 3 }], sideboard: [],
  })

  function setup(initial: DeckV2) {
    const schedulePersist = vi.fn<(next: DeckV2) => void>()
    const hook = renderHook(
      ({ d }: { d: DeckV2 }) => useDeckMutations({
        deck: d, schedulePersist, metaMap: new Map(), setMetaMap: vi.fn(), updateMetaForDeck: vi.fn(),
        serverFlaggedKeys: new Set<string>(), printingTargetCard: null, setPrintingTargetCard: vi.fn(),
      }),
      { initialProps: { d: initial } },
    )
    schedulePersist.mockImplementation((next) => hook.rerender({ d: next }))
    return { ...hook, schedulePersist }
  }

  it('assigns printings to the imported cards, not the pre-import deck', async () => {
    scryfallFor({ 'Lightning Bolt': { set: 'clu', collector_number: '141' } })
    const { result, schedulePersist } = setup(oldDeck())
    act(() => {
      result.current.handleApplyImport({
        mode: 'replace',
        cards: [{ cardName: 'Lightning Bolt', setCode: '', cardNumber: '', amount: 4 }],
        sideboard: [],
      })
    })
    await waitFor(() => expect(schedulePersist).toHaveBeenCalledTimes(2))
    const next = schedulePersist.mock.calls[1][0]
    expect(next.cards).toEqual([expect.objectContaining({ cardName: 'Lightning Bolt', setCode: 'CLU', cardNumber: '141', amount: 4 })])
  })

  it('also prints the designated commander of the import', async () => {
    scryfallFor({ "Atraxa, Praetors' Voice": { set: 'c16', collector_number: '189' } })
    const { result, schedulePersist } = setup(oldDeck())
    const atraxa = { cardName: "Atraxa, Praetors' Voice", setCode: '', cardNumber: '', amount: 1 }
    act(() => {
      result.current.handleApplyImport({ mode: 'replace', cards: [atraxa], sideboard: [], commanders: [atraxa] })
    })
    await waitFor(() => expect(schedulePersist).toHaveBeenCalledTimes(2))
    const next = schedulePersist.mock.calls[1][0]
    expect(next.commanderCard).toMatchObject({ setCode: 'C16', cardNumber: '189' })
  })

  it('drop-file applies the commander and resolves its printings like an import', async () => {
    scryfallFor({
      "Atraxa, Praetors' Voice": { set: 'c16', collector_number: '189' },
      'Lightning Bolt': { set: 'clu', collector_number: '141' },
    })
    const { result, schedulePersist } = setup(oldDeck())
    const file = { text: async () => "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n4 Lightning Bolt\n" } as unknown as File
    await act(async () => { await result.current.handleDropFile(file) })
    await waitFor(() => expect(schedulePersist).toHaveBeenCalledTimes(2))
    const next = schedulePersist.mock.calls[1][0]
    expect(next.commanderCard).toMatchObject({ cardName: "Atraxa, Praetors' Voice", setCode: 'C16', cardNumber: '189' })
    expect(next.cards.find((c) => c.cardName === 'Lightning Bolt')).toMatchObject({ setCode: 'CLU', cardNumber: '141' })
  })
})
