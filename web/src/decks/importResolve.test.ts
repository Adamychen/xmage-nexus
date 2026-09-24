import { describe, it, expect, vi, beforeEach } from 'vitest'

const scryfallJson = vi.hoisted(() => vi.fn())
vi.mock('../cards/scryfallClient', () => ({ scryfallJson }))

import { countUnresolved, isCommanderDeckFormat, resolveDeckPrintings, suggestFormat } from './importResolve'
import type { DeckCard } from '../lobby/decks'

const card = (cardName: string, amount = 1, setCode = '', cardNumber = ''): DeckCard => ({ cardName, setCode, cardNumber, amount })

function scry(name: string, set: string, num: string, legalities: Record<string, string> = {}) {
  return { object: 'card', name, set, collector_number: num, cmc: 1, type_line: 'Instant', legalities }
}

describe('suggestFormat', () => {
  it('prefers Commander when commanders are designated', () => {
    expect(suggestFormat({ cards: [card('A', 10)], sideboard: [], commanders: [card('Atraxa')] })).toBe('Commander')
  })
  it('detects Commander by 99/100 card counts', () => {
    expect(suggestFormat({ cards: [card('A', 99)], sideboard: [] })).toBe('Commander')
    expect(suggestFormat({ cards: [card('A', 99)], sideboard: [card('B', 1)] })).toBe('Commander')
  })
  it('detects a 60-card constructed deck and small lists', () => {
    expect(suggestFormat({ cards: [card('A', 60)], sideboard: [card('B', 15)] })).toBe('Standard')
    expect(suggestFormat({ cards: [card('A', 30)], sideboard: [] })).toBe('Freeform')
  })
  it('knows which formats are commander-style', () => {
    expect(isCommanderDeckFormat('Commander')).toBe(true)
    expect(isCommanderDeckFormat('Modern')).toBe(false)
  })
})

describe('resolveDeckPrintings', () => {
  beforeEach(() => {
    scryfallJson.mockReset()
  })

  it('assigns the default printing to every card without one, across zones', async () => {
    scryfallJson.mockImplementation(async (url: string) =>
      url.includes('Lightning%20Bolt') ? scry('Lightning Bolt', 'clu', '141', { modern: 'legal' }) : null)
    const res = await resolveDeckPrintings(
      { cards: [card('Lightning Bolt', 3)], sideboard: [card('Lightning Bolt', 1)] },
      { strategy: 'default' },
    )
    expect(res.cards[0]).toMatchObject({ setCode: 'CLU', cardNumber: '141', amount: 3 })
    expect(res.sideboard[0]).toMatchObject({ setCode: 'CLU', cardNumber: '141' })
    expect(res.resolved).toBe(1)
    expect(res.unresolved).toEqual([])
    expect(res.metaByName.get('lightning bolt')?.legalities?.modern).toBe('legal')
  })

  it('reports cards Scryfall cannot find and leaves them untouched', async () => {
    scryfallJson.mockResolvedValue(null)
    const res = await resolveDeckPrintings({ cards: [card('Nonexistent Card', 2)], sideboard: [] }, { strategy: 'default' })
    expect(res.unresolved).toEqual(['Nonexistent Card'])
    expect(res.cards[0]).toMatchObject({ setCode: '', cardNumber: '', amount: 2 })
  })

  it('does not touch cards that already have a printing but still collects their metadata', async () => {
    scryfallJson.mockResolvedValue(scry('Counterspell', 'mh2', '267'))
    const res = await resolveDeckPrintings({ cards: [card('Counterspell', 4, 'ICE', '64')], sideboard: [] }, { strategy: 'default' })
    expect(res.cards[0]).toMatchObject({ setCode: 'ICE', cardNumber: '64' })
    expect(res.resolved).toBe(0)
    expect(res.metaByName.has('counterspell')).toBe(true)
  })

  it('uses the oldest printing via a release-ordered search', async () => {
    scryfallJson.mockImplementation(async (url: string) =>
      url.includes('/cards/search') ? { data: [scry('Lightning Bolt', 'lea', '161'), scry('Lightning Bolt', 'clu', '141')] } : null)
    const res = await resolveDeckPrintings({ cards: [card('Lightning Bolt', 4)], sideboard: [] }, { strategy: 'oldest' })
    expect(res.cards[0]).toMatchObject({ setCode: 'LEA', cardNumber: '161' })
    expect(scryfallJson.mock.calls[0][0]).toContain('dir=asc')
  })

  it('prefers the chosen set and reports a fallback when the card is not in it', async () => {
    scryfallJson.mockImplementation(async (url: string) => {
      if (url.includes('set=m21')) return url.includes('Opt') ? scry('Opt', 'm21', '1') : null
      return scry('Shock', 'clu', '9')
    })
    const res = await resolveDeckPrintings(
      { cards: [card('Opt', 2), card('Shock', 2)], sideboard: [] },
      { strategy: 'set', setCode: 'M21' },
    )
    expect(res.cards.find((c) => c.cardName === 'Opt')).toMatchObject({ setCode: 'M21' })
    expect(res.cards.find((c) => c.cardName === 'Shock')).toMatchObject({ setCode: 'CLU' })
    expect(res.fellBack).toEqual(['Shock'])
  })

  it('keep strategy assigns no printings but still loads metadata', async () => {
    scryfallJson.mockResolvedValue(scry('Opt', 'm21', '1', { modern: 'legal' }))
    const res = await resolveDeckPrintings({ cards: [card('Opt', 4)], sideboard: [] }, { strategy: 'keep' })
    expect(res.cards[0].setCode).toBe('')
    expect(res.metaByName.get('opt')?.legalities?.modern).toBe('legal')
  })

  it('updates commanders and reports progress', async () => {
    scryfallJson.mockResolvedValue(scry('Atraxa, Praetors\' Voice', 'c16', '28'))
    const onProgress = vi.fn()
    const atraxa = card('Atraxa, Praetors\' Voice')
    const res = await resolveDeckPrintings({ cards: [atraxa], sideboard: [], commanders: [atraxa] }, { strategy: 'default', onProgress })
    expect(res.commanders?.[0]).toMatchObject({ setCode: 'C16', cardNumber: '28' })
    expect(onProgress).toHaveBeenLastCalledWith(1, 1)
  })

  it('counts unresolved printings by unique name', () => {
    expect(countUnresolved({ cards: [card('A'), card('a', 2), card('B', 1, 'X', '1')], sideboard: [card('C')] })).toBe(2)
  })
})
