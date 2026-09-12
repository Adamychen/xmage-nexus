import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDeckMutations } from './useDeckMutations'
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

function renderMutations(deck: DeckV2) {
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
    printingTargetCard: null,
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
