import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDeckMutations } from './useDeckMutations'
import { cardArtPreference, resetCardArtPreferences } from '../cards/artPreferences'
import type { DeckV2 } from './types'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'

const sidar: DeckCard = { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }
const tana: DeckCard = { cardName: 'Tana, the Bloodsower', setCode: 'C16', cardNumber: '56', amount: 1 }
const chooser: DeckCard = { cardName: 'Acolyte of Bahamut', setCode: 'CLB', cardNumber: '2', amount: 1 }
const background: DeckCard = { cardName: 'Raised by Giants', setCode: 'CLB', cardNumber: '3', amount: 1 }
const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 1 }

const partnerMeta: CardStripMeta = { keywords: ['Partner'], typeLine: 'Legendary Creature — Human' }
const chooserMeta: CardStripMeta = { oracleText: 'Choose a Background', typeLine: 'Legendary Creature — Dragon' }
const backgroundMeta: CardStripMeta = { typeLine: 'Legendary Enchantment — Background' }
const boltMeta: CardStripMeta = { typeLine: 'Instant', oracleText: 'Lightning Bolt deals 3 damage.' }

function makeDeck(over: Partial<DeckV2> = {}): DeckV2 {
  return {
    id: 'd1',
    name: 'Test',
    format: 'Commander',
    colors: [],
    cards: [],
    sideboard: [],
    createdAt: 0,
    updatedAt: 0,
    source: 'custom',
    ...over,
  }
}

function renderMutations(deck: DeckV2, printingTargetCard: DeckCard | null = null) {
  const schedulePersist = vi.fn()
  const metaMap = new Map<string, CardStripMeta>([
    ['PC2/1', partnerMeta],
    ['sidar kondo of jamuraa', partnerMeta],
    ['C16/56', partnerMeta],
    ['tana, the bloodsower', partnerMeta],
    ['CLB/2', chooserMeta],
    ['acolyte of bahamut', chooserMeta],
    ['CLB/3', backgroundMeta],
    ['raised by giants', backgroundMeta],
    ['M10/146', boltMeta],
    ['lightning bolt', boltMeta],
  ])
  const hook = renderHook(() => useDeckMutations({
    deck,
    schedulePersist,
    metaMap,
    setMetaMap: vi.fn(),
    updateMetaForDeck: vi.fn(),
    serverFlaggedKeys: new Set<string>(),
    printingTargetCard,
    setPrintingTargetCard: vi.fn(),
  }))
  return { ...hook, schedulePersist }
}

describe('useDeckMutations commander drops', () => {
  it('designates the first commander when the slot is empty', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar, tana] }))
    let accepted: boolean | void = undefined
    act(() => { accepted = result.current.handleDropCardOnDeck({ ...sidar, source: 'main' }, 'commander') })
    expect(accepted).toBe(true)
    expect(schedulePersist).toHaveBeenCalledTimes(1)
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ commanderCard: sidar, partnerCard: undefined })
  })

  it('sets the second commander when the dropped card is a legal pair', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar, tana], commanderCard: sidar }))
    act(() => { result.current.handleDropCardOnDeck({ ...tana, source: 'main' }, 'commander') })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ commanderCard: sidar, partnerCard: tana })
  })

  it('rejects an ineligible card that cannot pair', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar, bolt], commanderCard: sidar }))
    let accepted: boolean | void = undefined
    act(() => { accepted = result.current.handleDropCardOnDeck({ ...bolt, source: 'main' }, 'commander') })
    expect(accepted).toBe(false)
    expect(schedulePersist).not.toHaveBeenCalled()
  })

  it('pairs a Background with a choose-a-background commander', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [chooser, background], commanderCard: chooser }))
    act(() => { result.current.handleDropCardOnDeck({ ...background, source: 'main' }, 'commander') })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ commanderCard: chooser, partnerCard: background })
  })

  it('toggles the second commander and promotes it when the first is removed', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar, tana], commanderCard: sidar, partnerCard: tana }))
    act(() => { result.current.handleSetPartner(tana) })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ commanderCard: sidar, partnerCard: undefined })
    act(() => { result.current.handleSetCommander(sidar) })
    expect(schedulePersist.mock.calls[1][0]).toMatchObject({ commanderCard: tana, partnerCard: undefined })
  })

  it('rechaza designar la misma carta como pareja (AUDIT)', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar], commanderCard: sidar }))
    act(() => { result.current.handleSetPartner({ ...sidar }) })
    expect(schedulePersist).not.toHaveBeenCalled()
  })

  it('does not assign an illegal second commander via crown', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar, bolt], commanderCard: sidar }))
    act(() => { result.current.handleSetPartner(bolt) })
    expect(schedulePersist).not.toHaveBeenCalled()
  })
})

describe('useDeckMutations art preference', () => {
  beforeEach(() => resetCardArtPreferences())

  it('guardar arte no toca la impresión del mazo: solo la preferencia local', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [bolt] }), bolt)
    act(() => { result.current.handleApplyPrinting('LEA', '161') })
    expect(schedulePersist).not.toHaveBeenCalled()
    expect(cardArtPreference('Lightning Bolt')).toEqual({ setCode: 'LEA', cardNumber: '161' })
  })
})

describe('useDeckMutations import (AUDIT bloqueante)', () => {
  it('replace conserva el comandante si sigue en la lista nueva', () => {
    const { result, schedulePersist } = renderMutations(
      makeDeck({ cards: [sidar, tana], commanderCard: sidar, partnerCard: tana }),
    )
    act(() => {
      result.current.handleApplyImport({ cards: [sidar, bolt], sideboard: [], mode: 'replace' })
    })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ commanderCard: sidar, partnerCard: undefined })
  })

  it('replace limpia el comandante ausente en vez de dejarlo rancio', () => {
    const { result, schedulePersist } = renderMutations(
      makeDeck({ cards: [sidar, tana], commanderCard: sidar, partnerCard: tana }),
    )
    act(() => {
      result.current.handleApplyImport({ cards: [bolt], sideboard: [], mode: 'replace' })
    })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ commanderCard: undefined, partnerCard: undefined })
  })

  it('drop de fichero fusiona el banquillo sin duplicar filas', async () => {    const { result, schedulePersist } = renderMutations(makeDeck({ sideboard: [bolt] }))
    const file = { text: async () => 'SB: 1 [M10:146] Lightning Bolt\n' } as File
    await act(async () => { await result.current.handleDropFile(file) })
    const side = schedulePersist.mock.calls[0][0].sideboard as DeckCard[]
    expect(side).toHaveLength(1)
    expect(side[0]).toMatchObject({ cardName: 'Lightning Bolt', amount: 2 })
  })

  it('replace adopta los comandantes del import y add solo rellena huecos', () => {
    const atraxa: DeckCard = { cardName: "Atraxa, Praetors' Voice", setCode: 'C16', cardNumber: '28', amount: 1 }
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [bolt] }))
    act(() => {
      result.current.handleApplyImport({ cards: [atraxa, bolt], sideboard: [], commanders: [atraxa], mode: 'replace' })
    })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ commanderCard: atraxa })

    const { result: r2, schedulePersist: sp2 } = renderMutations(makeDeck({ cards: [sidar], commanderCard: sidar }))
    act(() => {
      r2.current.handleApplyImport({ cards: [atraxa], sideboard: [], commanders: [atraxa], mode: 'add' })
    })
    expect(sp2.mock.calls[0][0]).toMatchObject({ commanderCard: sidar })
  })
})

describe('useDeckMutations stack piles on import (DCK-7)', () => {
  const piles = { piles: [{ id: 'p1', label: 'Burn' }], assign: { 'M10:146:Lightning Bolt': { p1: 4 } } }
  const ownPiles = { piles: [{ id: 'p7', label: 'Own' }], assign: { 'LEA:292:Mountain': { p7: 1 } } }

  it('DCK-7: replace adopts the piles of the imported file', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar], stackPiles: ownPiles }))
    act(() => {
      result.current.handleApplyImport({ cards: [bolt], sideboard: [], stackPiles: piles, mode: 'replace' })
    })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ stackPiles: piles })
  })

  it('DCK-7: add keeps the deck own piles and takes the imported ones only when it has none', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar], stackPiles: ownPiles }))
    act(() => {
      result.current.handleApplyImport({ cards: [bolt], sideboard: [], stackPiles: piles, mode: 'add' })
    })
    expect(schedulePersist.mock.calls[0][0]).toMatchObject({ stackPiles: ownPiles })

    const { result: r2, schedulePersist: sp2 } = renderMutations(makeDeck({ cards: [sidar] }))
    act(() => {
      r2.current.handleApplyImport({ cards: [bolt], sideboard: [], stackPiles: piles, mode: 'add' })
    })
    expect(sp2.mock.calls[0][0]).toMatchObject({ stackPiles: piles })
  })

  it('DCK-7: dropping a .dck file on the deck keeps its piles when the deck has none', async () => {
    const { result, schedulePersist } = renderMutations(makeDeck({ cards: [sidar] }))
    const file = { text: async () => '4 [M10:146] Lightning Bolt\nLAYOUT MAIN:(1,1)(NONE,false,50)|([M10:146],[M10:146],[M10:146],[M10:146])\n' } as File
    await act(async () => { await result.current.handleDropFile(file) })
    expect(schedulePersist.mock.calls[0][0].stackPiles).toMatchObject({ assign: { 'M10:146:Lightning Bolt': { p1: 4 } } })
  })
})

describe('useDeckMutations Free piles (DCK-7)', () => {
  const boltRef = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', source: 'search' }

  it('DCK-7: a catalogue card dropped on a pile adds one copy to that pile and leaves the others where they were', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({
      cards: [bolt],
      stackPiles: { piles: [{ id: 'p1', label: 'Spells' }], assign: {} },
    }))
    act(() => { result.current.handleStacksDrop('main', boltRef, { kind: 'pile', pileId: 'p1' }) })
    const next = schedulePersist.mock.calls.at(-1)![0] as DeckV2
    expect(next.cards.find((c) => c.cardName === 'Lightning Bolt')?.amount).toBe(2)
    expect(next.stackPiles?.assign['M10:146:Lightning Bolt']).toEqual({ p1: 1, unsorted: 1 })
  })

  it('DCK-7: a sideboard card moved onto a new pile joins it in the main deck', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({
      sideboard: [bolt],
      stackPiles: { piles: [], assign: {} },
    }))
    act(() => { result.current.handleStacksDrop('main', { source: 'sideboard', key: 'sb:M10:146:Lightning Bolt' }, { kind: 'new', label: 'Pile 1' }) })
    const next = schedulePersist.mock.calls.at(-1)![0] as DeckV2
    expect(next.cards).toEqual([expect.objectContaining({ cardName: 'Lightning Bolt', amount: 1 })])
    expect(next.sideboard).toHaveLength(0)
    const [pile] = next.stackPiles?.piles ?? []
    expect(pile).toMatchObject({ label: 'Pile 1' })
    expect(next.stackPiles?.assign['M10:146:Lightning Bolt']).toEqual({ [pile.id]: 1 })
  })

  it('DCK-7: the panel moving a card to Unsorted moves every copy there', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({
      cards: [bolt],
      stackPiles: { piles: [{ id: 'p1', label: 'Spells' }], assign: { 'M10:146:Lightning Bolt': { p1: 1 } } },
    }))
    act(() => { result.current.handleAssignPile('M10:146:Lightning Bolt', { kind: 'pile', pileId: 'unsorted' }) })
    const next = schedulePersist.mock.calls.at(-1)![0] as DeckV2
    expect(next.stackPiles?.assign).toEqual({ 'M10:146:Lightning Bolt': { unsorted: 1 } })
  })

  const boltKey = 'M10:146:Lightning Bolt'
  const four = makeDeck({
    cards: [{ ...bolt, amount: 4 }],
    stackPiles: {
      piles: [{ id: 'p1', label: 'Burn' }, { id: 'p2', label: 'Finish' }],
      assign: { [boltKey]: { p1: 4 } },
    },
  })
  const lastPersisted = (schedulePersist: ReturnType<typeof vi.fn>) => schedulePersist.mock.calls.at(-1)![0] as DeckV2

  it('DCK-7: dragging one copy of a 4-copy card to another pile leaves 3 and 1, and the card keeps 4 copies', () => {
    const { result, schedulePersist } = renderMutations(four)
    act(() => { result.current.handleStacksDrop('main', { source: 'main', key: boltKey, pileId: 'p1' }, { kind: 'pile', pileId: 'p2' }) })
    const next = lastPersisted(schedulePersist)
    expect(next.stackPiles?.assign[boltKey]).toEqual({ p1: 3, p2: 1 })
    expect(next.cards).toEqual([expect.objectContaining({ cardName: 'Lightning Bolt', amount: 4 })])
  })

  it('DCK-7: dropping one copy of a card on the new pile column creates the pile with that copy', () => {
    const { result, schedulePersist } = renderMutations(four)
    act(() => { result.current.handleStacksDrop('main', { source: 'main', key: boltKey, pileId: 'p1' }, { kind: 'new', label: 'Pile 3' }) })
    const next = lastPersisted(schedulePersist)
    expect(next.stackPiles?.piles).toEqual([
      { id: 'p1', label: 'Burn' }, { id: 'p2', label: 'Finish' }, { id: 'p3', label: 'Pile 3' },
    ])
    expect(next.stackPiles?.assign[boltKey]).toEqual({ p1: 3, p3: 1 })
  })

  it('DCK-7: the panel Move to pile moves every copy of the card at once', () => {
    const { result, schedulePersist } = renderMutations({
      ...four,
      stackPiles: { ...four.stackPiles!, assign: { [boltKey]: { p1: 3, p2: 1 } } },
    })
    act(() => { result.current.handleAssignPile(boltKey, { kind: 'pile', pileId: 'p2' }) })
    expect(lastPersisted(schedulePersist).stackPiles?.assign[boltKey]).toEqual({ p2: 4 })
  })

  it('DCK-7: the panel New pile moves every copy into the new pile', () => {
    const { result, schedulePersist } = renderMutations({
      ...four,
      stackPiles: { ...four.stackPiles!, assign: { [boltKey]: { p1: 3, p2: 1 } } },
    })
    act(() => { result.current.handleAssignPile(boltKey, { kind: 'new', label: 'Pile 3' }) })
    const next = lastPersisted(schedulePersist)
    expect(next.stackPiles?.assign[boltKey]).toEqual({ p3: 4 })
  })

  it('DCK-7: moving a copy to the sideboard takes it out of the pile it was dragged from', () => {
    const { result, schedulePersist } = renderMutations({
      ...four,
      stackPiles: { ...four.stackPiles!, assign: { [boltKey]: { p1: 3, p2: 1 } } },
    })
    act(() => { result.current.handleStacksDrop('side', { source: 'main', key: boltKey, pileId: 'p2' }) })
    const next = lastPersisted(schedulePersist)
    expect(next.cards).toEqual([expect.objectContaining({ amount: 3 })])
    expect(next.sideboard).toEqual([expect.objectContaining({ cardName: 'Lightning Bolt', amount: 1 })])
    expect(next.stackPiles?.assign[boltKey]).toEqual({ p1: 3 })
  })

  it('DCK-7: a copy moved to the sideboard from the card panel leaves the pile holding most copies', () => {
    const { result, schedulePersist } = renderMutations({
      ...four,
      stackPiles: { ...four.stackPiles!, assign: { [boltKey]: { p1: 1, p2: 3 } } },
    })
    act(() => { result.current.handleSwap(boltKey) })
    expect(lastPersisted(schedulePersist).stackPiles?.assign[boltKey]).toEqual({ p1: 1, p2: 2 })
  })

  it('DCK-7: + and - in a pile add and remove a copy of that pile', () => {
    const split = { ...four, stackPiles: { ...four.stackPiles!, assign: { [boltKey]: { p1: 3, p2: 1 } } } }
    let r = renderMutations(split)
    act(() => { r.result.current.handleInc(boltKey, 'p2') })
    expect(lastPersisted(r.schedulePersist).stackPiles?.assign[boltKey]).toEqual({ p1: 3, p2: 2 })
    expect(lastPersisted(r.schedulePersist).cards[0].amount).toBe(5)

    r = renderMutations(split)
    act(() => { r.result.current.handleDec(boltKey, 'p1') })
    expect(lastPersisted(r.schedulePersist).stackPiles?.assign[boltKey]).toEqual({ p1: 2, p2: 1 })
  })

  it('DCK-7: a sideboard copy dropped on a pile joins the main deck in that pile', () => {
    const { result, schedulePersist } = renderMutations(makeDeck({
      cards: [{ ...bolt, amount: 2 }],
      sideboard: [bolt],
      stackPiles: { piles: [{ id: 'p1', label: 'Burn' }, { id: 'p2', label: 'Finish' }], assign: { [boltKey]: { p1: 2 } } },
    }))
    act(() => { result.current.handleStacksDrop('main', { source: 'sideboard', key: `sb:${boltKey}` }, { kind: 'pile', pileId: 'p2' }) })
    const next = lastPersisted(schedulePersist)
    expect(next.cards[0].amount).toBe(3)
    expect(next.stackPiles?.assign[boltKey]).toEqual({ p1: 2, p2: 1 })
  })
})
