import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useDeckMutations } from './useDeckMutations'
import { getCachedCardName } from '../cards/cardLocalization'
import { getState, setState } from '../state/state'
import { BASIC_LAND_PRESETS } from './deckUtils'
import type { DeckV2 } from './types'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { ScryfallSearchCard } from './scryfallSearch'

const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 2 }
const shock: DeckCard = { cardName: 'Shock', setCode: 'M21', cardNumber: '159', amount: 1 }
const grist: DeckCard = { cardName: 'Grist, the Hunger Tide', setCode: 'MH2', cardNumber: '199', amount: 1 }
const plains = BASIC_LAND_PRESETS.find((p) => p.name === 'Plains')!
const island = BASIC_LAND_PRESETS.find((p) => p.name === 'Island')!

function makeDeck(over: Partial<DeckV2> = {}): DeckV2 {
  return {
    id: 'd1',
    name: 'Test',
    format: 'Modern',
    colors: [],
    cards: [],
    sideboard: [],
    createdAt: 0,
    updatedAt: 0,
    source: 'custom',
    ...over,
  }
}

function setup(deck: DeckV2 | null, opts: { metaMap?: Map<string, CardStripMeta>; eligibility?: Map<string, boolean> } = {}) {
  const schedulePersist = vi.fn()
  const setMetaMap = vi.fn()
  const setPrintingTargetCard = vi.fn()
  const hook = renderHook(() => useDeckMutations({
    deck,
    schedulePersist,
    metaMap: opts.metaMap ?? new Map(),
    setMetaMap,
    updateMetaForDeck: vi.fn(),
    serverFlaggedKeys: new Set<string>(),
    printingTargetCard: null,
    setPrintingTargetCard,
    commanderEligibilityMap: opts.eligibility ?? null,
  }))
  const persisted = (): DeckV2 => schedulePersist.mock.lastCall![0]
  return { m: hook.result.current, schedulePersist, setMetaMap, setPrintingTargetCard, persisted }
}

const key = (c: DeckCard) => `${c.setCode}:${c.cardNumber}:${c.cardName}`

const initialError = getState().error
beforeEach(() => setState({ error: null }))
afterEach(() => {
  cleanup()
  setState({ error: initialError })
})

describe('useDeckMutations: no deck', () => {
  it('no handler persists anything', async () => {
    const { m, schedulePersist } = setup(null)
    act(() => {
      m.handleSwap('x')
      m.handleInc('x')
      m.handleDec('x')
      m.handleRemove('x')
      m.handleSetCover(bolt)
      m.handleSetCommander(bolt)
      m.handleSetPartner(bolt)
      m.handleAddBasicLand(plains)
      m.handleRemoveBasicLand(plains)
      m.handleApplySuggestedLands([])
      m.handleDropCardOnDeck(bolt, 'main')
    })
    await m.handleDropFile({ text: async () => '4 Lightning Bolt' } as File)
    expect(schedulePersist).not.toHaveBeenCalled()
  })
})

describe('useDeckMutations: amounts', () => {
  const deck = makeDeck({ cards: [bolt], sideboard: [shock] })

  it('inc/dec/remove in the main deck', () => {
    let s = setup(deck)
    act(() => s.m.handleInc(key(bolt)))
    expect(s.persisted().cards).toEqual([{ ...bolt, amount: 3 }])

    s = setup(deck)
    act(() => s.m.handleDec(key(bolt)))
    expect(s.persisted().cards).toEqual([{ ...bolt, amount: 1 }])

    s = setup(deck)
    act(() => s.m.handleRemove(key(bolt)))
    expect(s.persisted().cards).toEqual([])
    expect(s.persisted().sideboard).toEqual([shock])
  })

  it('sb: keys act on the sideboard', () => {
    let s = setup(deck)
    act(() => s.m.handleInc(`sb:${key(shock)}`))
    expect(s.persisted().sideboard).toEqual([{ ...shock, amount: 2 }])
    expect(s.persisted().cards).toEqual([bolt])

    s = setup(deck)
    act(() => s.m.handleDec(`sb:${key(shock)}`))
    expect(s.persisted().sideboard).toEqual([])

    s = setup(deck)
    act(() => s.m.handleRemove(`sb:${key(shock)}`))
    expect(s.persisted().sideboard).toEqual([])
    expect(s.persisted().cards).toEqual([bolt])
  })

  it('swap moves one copy each way', () => {
    let s = setup(deck)
    act(() => s.m.handleSwap(key(bolt)))
    expect(s.persisted().cards).toEqual([{ ...bolt, amount: 1 }])
    expect(s.persisted().sideboard).toEqual(expect.arrayContaining([shock, { ...bolt, amount: 1 }]))

    s = setup(deck)
    act(() => s.m.handleSwap(`sb:${key(shock)}`))
    expect(s.persisted().sideboard).toEqual([])
    expect(s.persisted().cards).toEqual(expect.arrayContaining([bolt, shock]))
  })

  it('handleSetCover only changes the cover', () => {
    const s = setup(deck)
    act(() => s.m.handleSetCover(shock))
    expect(s.persisted()).toEqual({ ...deck, coverCard: shock })
  })
})

describe('useDeckMutations: basic lands', () => {
  it('adds the basic with its printing and uses it as cover when there is none', () => {
    const s = setup(makeDeck())
    act(() => s.m.handleAddBasicLand(plains))
    const land = { cardName: 'Plains', setCode: plains.setCode, cardNumber: plains.cardNumber, amount: 1 }
    expect(s.persisted().cards).toEqual([land])
    expect(s.persisted().coverCard).toEqual(land)
  })

  it('adds to the existing one (case-insensitive) capped at 99', () => {
    const s = setup(makeDeck({ cards: [{ cardName: 'plains', setCode: 'LEA', cardNumber: '1', amount: 99 }], coverCard: bolt }))
    act(() => s.m.handleAddBasicLand(plains))
    expect(s.persisted().cards).toEqual([{ cardName: 'plains', setCode: 'LEA', cardNumber: '1', amount: 99 }])
    expect(s.persisted().coverCard).toEqual(bolt)
  })

  it('removes one copy and the row when it reaches zero', () => {
    const land = { cardName: 'Plains', setCode: 'DMU', cardNumber: '277', amount: 2 }
    let s = setup(makeDeck({ cards: [land, bolt] }))
    act(() => s.m.handleRemoveBasicLand(plains))
    expect(s.persisted().cards).toEqual([{ ...land, amount: 1 }, bolt])

    s = setup(makeDeck({ cards: [{ ...land, amount: 1 }, bolt] }))
    act(() => s.m.handleRemoveBasicLand(plains))
    expect(s.persisted().cards).toEqual([bolt])

    s = setup(makeDeck({ cards: [bolt] }))
    act(() => s.m.handleRemoveBasicLand(island))
    expect(s.schedulePersist).not.toHaveBeenCalled()
  })

  it('suggested lands replace every basic', () => {
    const s = setup(makeDeck({ cards: [bolt, { cardName: 'Island', setCode: 'DMU', cardNumber: '278', amount: 10 }] }))
    act(() => s.m.handleApplySuggestedLands([{ name: 'Mountain', setCode: 'DMU', cardNumber: '280', amount: 18 }]))
    expect(s.persisted().cards.map((c) => `${c.amount} ${c.cardName}`)).toEqual(['2 Lightning Bolt', '18 Mountain'])
  })
})

describe('useDeckMutations: search and drag', () => {
  const searchBolt: ScryfallSearchCard = {
    id: 'x',
    name: 'Lightning Bolt',
    printed_name: 'Rayo',
    lang: 'es',
    set: 'm10',
    collector_number: '146',
    mana_cost: '{R}',
    cmc: 1,
    type_line: 'Instant',
    colors: ['R'],
    color_identity: ['R'],
  }

  it('adding from search stores the card, its meta and the localized name', () => {
    const s = setup(makeDeck())
    act(() => s.m.handleAddFromSearch(searchBolt))

    expect(s.persisted().cards).toEqual([{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 1 }])
    expect(s.persisted().coverCard).toEqual(s.persisted().cards[0])
    const meta: Map<string, CardStripMeta> = s.setMetaMap.mock.lastCall![0]
    expect(meta.get('M10/146')).toMatchObject({ manaCost: '{R}', typeLine: 'Instant' })
    expect(meta.get('lightning bolt')).toBe(meta.get('M10/146'))
    expect(getCachedCardName('Lightning Bolt', 'es')).toBe('Rayo')
  })

  it('dropping from main to sideboard (and back) moves one copy', () => {
    const deck = makeDeck({ cards: [bolt], sideboard: [shock] })
    let s = setup(deck)
    act(() => { s.m.handleDropCardOnDeck({ ...bolt, source: 'main' }, 'sideboard') })
    expect(s.persisted().cards).toEqual([{ ...bolt, amount: 1 }])

    s = setup(deck)
    act(() => { s.m.handleDropCardOnDeck({ ...shock, source: 'sideboard' }, 'main') })
    expect(s.persisted().sideboard).toEqual([])
  })

  it('dropping a new card inserts it and caches the meta it carries', () => {
    const s = setup(makeDeck())
    act(() => {
      s.m.handleDropCardOnDeck({ cardName: 'Shock', setCode: 'm21', cardNumber: '159', manaCost: '{R}', typeLine: 'Instant' }, 'main')
    })
    expect(s.persisted().cards).toEqual([shock])
    expect(s.persisted().coverCard).toEqual(shock)

    const updater = s.setMetaMap.mock.lastCall![0] as (prev: Map<string, CardStripMeta>) => Map<string, CardStripMeta>
    const next = updater(new Map())
    expect(next.get('M21/159')).toMatchObject({ manaCost: '{R}', typeLine: 'Instant', cmc: 0 })
    expect(next.get('shock')).toBe(next.get('M21/159'))
  })

  it('dropping on the sideboard leaves the cover alone and caches no empty meta', () => {
    const s = setup(makeDeck({ cards: [bolt] }))
    act(() => { s.m.handleDropCardOnDeck({ cardName: 'Shock', setCode: 'M21', cardNumber: '159' }, 'sideboard') })
    expect(s.persisted().sideboard).toEqual([shock])
    expect(s.persisted().coverCard).toBeUndefined()
    expect(s.setMetaMap).not.toHaveBeenCalled()
  })

  it('a card without a name is ignored', () => {
    const s = setup(makeDeck())
    act(() => { s.m.handleDropCardOnDeck({ setCode: 'M21' }, 'main') })
    expect(s.schedulePersist).not.toHaveBeenCalled()
  })
})

describe('useDeckMutations: commander eligibility from the proxy', () => {
  // Grist is a Planeswalker by type line; the local heuristic only accepts it
  // through the "isn't on the battlefield" text. Without that text the decision
  // rests on the real XMage classes the proxy reports.
  const gristMeta: CardStripMeta = { typeLine: 'Legendary Planeswalker — Grist', oracleText: '' }
  const metaMap = new Map([['MH2/199', gristMeta]])

  it('the proxy accepts what the local heuristic would reject', () => {
    const s = setup(makeDeck({ format: 'Commander', cards: [grist] }), {
      metaMap,
      eligibility: new Map([['grist, the hunger tide', true]]),
    })
    let accepted: boolean | void = undefined
    act(() => { accepted = s.m.handleDropCardOnDeck({ ...grist, source: 'main' }, 'commander') })
    expect(accepted).toBe(true)
    expect(s.persisted().commanderCard).toMatchObject({ cardName: grist.cardName })
  })

  it('the proxy rejects even if the heuristic would accept', () => {
    const s = setup(makeDeck({ format: 'Commander', cards: [bolt] }), {
      eligibility: new Map([['lightning bolt', false]]),
    })
    let accepted: boolean | void = undefined
    act(() => { accepted = s.m.handleDropCardOnDeck({ ...bolt, source: 'main' }, 'commander') })
    expect(accepted).toBe(false)
    expect(s.schedulePersist).not.toHaveBeenCalled()
  })

  it('without proxy data or meta, the drop is allowed', () => {
    const s = setup(makeDeck({ format: 'Commander' }))
    let accepted: boolean | void = undefined
    act(() => { accepted = s.m.handleDropCardOnDeck({ ...grist, source: 'search' }, 'commander') })
    expect(accepted).toBe(true)
  })
})

describe('useDeckMutations: printings and files', () => {
  it('handleChangePrinting opens the picker for that card', () => {
    const s = setup(makeDeck({ cards: [bolt] }))
    act(() => s.m.handleChangePrinting(bolt))
    expect(s.setPrintingTargetCard).toHaveBeenCalledWith(bolt)
  })

  it('an unrecognized file shows the error and leaves the deck alone', async () => {
    const s = setup(makeDeck({ cards: [bolt] }))
    await act(() => s.m.handleDropFile({ text: async () => 'this is not a deck' } as File))
    expect(s.schedulePersist).not.toHaveBeenCalled()
    expect(getState().error).toBe('No se pudieron reconocer cartas. Formato esperado: "4 Lightning Bolt"')
  })
})
