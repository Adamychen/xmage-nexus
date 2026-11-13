import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ current: null as ReturnType<typeof makeStorage> | null }))
vi.mock('./storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage')>()
  return { ...actual, getDeckStorage: () => store.current! }
})

import { createMemoryStorage } from './storage'
import { isRepairPersistable, persistDeckRepair } from './deckRepair'
import type { DeckFix } from './deckIssues'
import type { DeckV2 } from './types'

const RIP_OLD = { cardName: 'Rest in Peace', setCode: 'MM3', cardNumber: '20' }
const RIP_NEW = { cardName: 'Rest in Peace', setCode: 'AVR', cardNumber: '27' }
const toNewPrinting: DeckFix[] = [{ from: RIP_OLD, to: RIP_NEW }]

function storedDeck(): DeckV2 {
  return {
    id: 'd1',
    name: 'Mono White Humans',
    format: 'Modern',
    colors: ['W'],
    createdAt: 1,
    updatedAt: 1,
    source: 'custom',
    cards: [
      { ...RIP_OLD, amount: 4 },
      { cardName: 'Plains', setCode: 'LEA', cardNumber: '287', amount: 20 },
    ],
    sideboard: [{ ...RIP_OLD, amount: 1 }],
    coverCard: { ...RIP_OLD, amount: 1 },
  }
}

function makeStorage(decks: DeckV2[]) {
  const memory = createMemoryStorage()
  memory.seed(decks)
  vi.spyOn(memory, 'put')
  return memory
}

beforeEach(() => {
  store.current = makeStorage([storedDeck()])
})

describe('persistDeckRepair', () => {
  it('DCK-30: writes the repaired printing to the stored deck', async () => {
    const saved = await persistDeckRepair('d1', toNewPrinting)

    expect(saved?.cards[0]).toMatchObject({ setCode: 'AVR', cardNumber: '27', amount: 4 })
    expect(saved?.sideboard[0]).toMatchObject({ setCode: 'AVR', cardNumber: '27', amount: 1 })
    expect(saved?.coverCard).toMatchObject({ setCode: 'AVR', cardNumber: '27' })
    expect(saved?.cards[1]).toMatchObject({ cardName: 'Plains', setCode: 'LEA', cardNumber: '287' })

    const reread = await store.current!.get('d1')
    expect(reread?.cards[0]).toMatchObject({ setCode: 'AVR', cardNumber: '27' })
  })

  it('DCK-30: leaves alone a deck that is not in the player storage', async () => {
    expect(await persistDeckRepair('precon:Mage Web bolt', toNewPrinting)).toBeNull()
    expect(await persistDeckRepair(undefined, toNewPrinting)).toBeNull()
    expect(store.current!.put).not.toHaveBeenCalled()
  })

  it('DCK-30: writes nothing when the fixes change no printing', async () => {
    expect(await persistDeckRepair('d1', [])).toBeNull()
    expect(await persistDeckRepair('d1', [{ from: { cardName: 'Shock', setCode: 'M21', cardNumber: '159' }, to: RIP_NEW }])).toBeNull()
    expect(store.current!.put).not.toHaveBeenCalled()
  })

  it('DCK-30: a second repair reads what the first one saved', async () => {
    const both = await Promise.all([
      persistDeckRepair('d1', toNewPrinting),
      persistDeckRepair('d1', [{ from: { cardName: 'Plains', setCode: 'LEA', cardNumber: '287' }, to: { cardName: 'Plains', setCode: 'DSK', cardNumber: '273' } }]),
    ])

    expect(both[1]?.cards[0]).toMatchObject({ setCode: 'AVR', cardNumber: '27' })
    expect(both[1]?.cards[1]).toMatchObject({ setCode: 'DSK', cardNumber: '273' })
    const reread = await store.current!.get('d1')
    expect(reread?.cards.map((c) => `${c.setCode}#${c.cardNumber}`)).toEqual(['AVR#27', 'DSK#273'])
  })
})

describe('isRepairPersistable', () => {
  it('DCK-30: is true for a stored deck and false for anything else', async () => {
    expect(await isRepairPersistable('d1')).toBe(true)
    expect(await isRepairPersistable('precon:Mage Web bolt')).toBe(false)
    expect(await isRepairPersistable(undefined)).toBe(false)
  })
})
