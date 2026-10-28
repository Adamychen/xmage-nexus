import { describe, expect, it } from 'vitest'
import {
  addCopies, addPile, assignAllCopies, largestPile, moveCopies, normalizeStackPiles, pilesHolding, pruneStackPiles,
  reconcileCopies, reconcileStackPiles, removePile, renamePile, seedStackPiles, takeCopies, type DeckStackPiles,
} from './stackPiles'
import { deckCardKey } from './deckCardOps'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'

const typeLabels = {
  creatures: 'Creatures', planeswalkers: 'Planeswalkers', instants: 'Instants', sorceries: 'Sorceries',
  enchantments: 'Enchantments', artifacts: 'Artifacts', lands: 'Lands', other: 'Other',
}

const card = (cardName: string, amount = 1): DeckCard => ({ cardName, setCode: 'SET', cardNumber: cardName, amount })
const metas: Record<string, CardStripMeta> = {
  Bolt: { cmc: 1, typeLine: 'Instant' },
  Angel: { cmc: 5, typeLine: 'Creature — Angel' },
  Mountain: { cmc: 0, typeLine: 'Basic Land — Mountain' },
}
const metaOf = (c: DeckCard) => metas[c.cardName]

const sp = (piles: DeckStackPiles['piles'], assign: DeckStackPiles['assign'] = {}): DeckStackPiles => ({ piles, assign })
const bolt = deckCardKey(card('Bolt'))
const angel = deckCardKey(card('Angel'))

describe('seedStackPiles', () => {
  it('DCK-7: makes one pile per non-empty type, in type order, and assigns every copy of every card', () => {
    const seeded = seedStackPiles([card('Mountain', 3), card('Bolt', 2), card('Angel')], metaOf, typeLabels)
    expect(seeded.piles).toEqual([
      { id: 'p1', label: 'Creatures' },
      { id: 'p2', label: 'Instants' },
      { id: 'p3', label: 'Lands' },
    ])
    expect(seeded.assign).toEqual({
      [deckCardKey(card('Mountain'))]: { p3: 3 },
      [bolt]: { p2: 2 },
      [angel]: { p1: 1 },
    })
  })

  it('DCK-7: keeps a card without meta in the Other pile instead of skipping it', () => {
    const seeded = seedStackPiles([card('Pending'), card('Bolt')], metaOf, typeLabels)
    expect(seeded.piles).toEqual([{ id: 'p1', label: 'Instants' }, { id: 'p2', label: 'Other' }])
    expect(seeded.assign[deckCardKey(card('Pending'))]).toEqual({ p2: 1 })
  })

  it('DCK-7: a deck with no cards has no piles', () => {
    expect(seedStackPiles([], metaOf, typeLabels)).toEqual({ piles: [], assign: {} })
  })
})

describe('normalizeStackPiles (DCK-7 migration)', () => {
  it('DCK-7: a saved single pile id means every copy of the card is in that pile', () => {
    const stored = { piles: [{ id: 'p1', label: 'Burn' }], assign: { [bolt]: 'p1' } }
    const normalized = normalizeStackPiles(stored, [card('Bolt', 4)])
    expect(normalized).toEqual({ piles: [{ id: 'p1', label: 'Burn' }], assign: { [bolt]: { p1: 4 } } })
  })

  it('DCK-7: the per-copy form is kept as it is, without the zero or invalid counts', () => {
    const stored = { piles: [{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], assign: { [bolt]: { p1: 3, p2: 0 } } }
    expect(normalizeStackPiles(stored, [card('Bolt', 4)])?.assign).toEqual({ [bolt]: { p1: 3 } })
  })

  it('DCK-7: a stored assignment of a card that is no longer in the deck is dropped', () => {
    const stored = { piles: [{ id: 'p1', label: 'A' }], assign: { [bolt]: 'p1', [angel]: 'p1' } }
    expect(normalizeStackPiles(stored, [card('Bolt')])?.assign).toEqual({ [bolt]: { p1: 1 } })
  })

  it('DCK-7: no stored piles normalise to none', () => {
    expect(normalizeStackPiles(undefined, [card('Bolt')])).toBeUndefined()
  })
})

describe('reconcileCopies (DCK-7 copies up and down)', () => {
  it('DCK-7: a missing copy goes to the pile holding most of the card', () => {
    expect(reconcileCopies({ p1: 2, p2: 3 }, 6, ['p1', 'p2'])).toEqual({ piles: { p1: 2, p2: 4 }, unsorted: 0 })
  })

  it('DCK-7: a missing copy with no pile holding the card is unsorted', () => {
    expect(reconcileCopies({}, 3, ['p1'])).toEqual({ piles: {}, unsorted: 3 })
  })

  it('DCK-7: a surplus copy leaves the pile with the fewest copies first', () => {
    expect(reconcileCopies({ p1: 3, p2: 1, p3: 2 }, 5, ['p1', 'p2', 'p3'])).toEqual({ piles: { p1: 3, p3: 2 }, unsorted: 0 })
    expect(reconcileCopies({ p1: 3, p2: 2 }, 3, ['p1', 'p2'])).toEqual({ piles: { p1: 3 }, unsorted: 0 })
  })

  it('DCK-7: copies moved out into Unsorted stay there, and a new copy goes to the pile holding most', () => {
    expect(reconcileCopies({ p1: 2, unsorted: 1 }, 4, ['p1'])).toEqual({ piles: { p1: 3 }, unsorted: 1 })
    expect(reconcileCopies({ p1: 3, unsorted: 2 }, 4, ['p1'])).toEqual({ piles: { p1: 3 }, unsorted: 1 })
  })

  it('DCK-7: a pile the deck no longer has counts for nothing', () => {
    expect(reconcileCopies({ p9: 2, p1: 1 }, 2, ['p1'])).toEqual({ piles: { p1: 2 }, unsorted: 0 })
  })

  it('DCK-7: reconcileStackPiles gives every card its real amount and drops cards not in the deck', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p1: 1 }, [angel]: { p2: 9 } })
    const out = reconcileStackPiles(input, [card('Bolt', 3)])
    expect(out.assign).toEqual({ [bolt]: { p1: 3 } })
  })

  it('DCK-7: reconcileStackPiles keeps a card in no pile as unsorted copies', () => {
    const out = reconcileStackPiles(sp([{ id: 'p1', label: 'A' }]), [card('Bolt', 3)])
    expect(out.assign).toEqual({ [bolt]: { unsorted: 3 } })
  })

  it('DCK-7: largestPile is the pile with most copies, the first one on a tie', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p1: 1, p2: 3 }, [angel]: { p1: 2, p2: 2 } })
    expect(largestPile(input, bolt)).toBe('p2')
    expect(largestPile(input, angel)).toBe('p1')
    expect(largestPile(input, 'missing')).toBeUndefined()
  })

  it('DCK-7: pilesHolding lists the piles that hold copies once reconciled', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p1: 3, p2: 1 } })
    expect(pilesHolding(input, bolt, 4)).toEqual(['p1', 'p2'])
    expect(pilesHolding(input, bolt, 2)).toEqual(['p1'])
  })
})

describe('pile helpers', () => {
  it('DCK-7: addPile numbers the new pile with the next free id and leaves its input unchanged', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p3', label: 'C' }])
    const { next, id } = addPile(input, 'New')
    expect(id).toBe('p2')
    expect(next.piles).toEqual([{ id: 'p1', label: 'A' }, { id: 'p3', label: 'C' }, { id: 'p2', label: 'New' }])
    expect(input.piles).toHaveLength(2)
  })

  it('DCK-7: addPile skips an id that a card still has copies in', () => {
    const { id } = addPile(sp([{ id: 'p1', label: 'A' }], { [bolt]: { p2: 1 } }), 'New')
    expect(id).toBe('p3')
  })

  it('DCK-7: renamePile trims the label and ignores a blank name or an unknown pile', () => {
    const input = sp([{ id: 'p1', label: 'A' }])
    expect(renamePile(input, 'p1', '  Burn  ').piles).toEqual([{ id: 'p1', label: 'Burn' }])
    expect(input.piles).toEqual([{ id: 'p1', label: 'A' }])
    expect(renamePile(input, 'p1', '   ')).toBe(input)
    expect(renamePile(input, 'p9', 'Burn')).toBe(input)
  })

  it('DCK-7: removePile removes a pile that holds no copy only', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p2: 1 } })
    expect(removePile(input, 'p2')).toBe(input)
    expect(removePile(input, 'p9')).toBe(input)
    expect(removePile(input, 'p1').piles).toEqual([{ id: 'p2', label: 'B' }])
  })

  it('DCK-7: moveCopies moves some of a card\'s copies from one pile to another and leaves the rest', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p1: 4 } })
    const moved = moveCopies(input, bolt, 'p1', 'p2', 1)
    expect(moved.assign[bolt]).toEqual({ p1: 3, p2: 1 })
    expect(input.assign[bolt]).toEqual({ p1: 4 })
  })

  it('DCK-7: moveCopies moves a copy from a pile into Unsorted and back, keeping the card total', () => {
    const input = sp([{ id: 'p1', label: 'A' }], { [bolt]: { p1: 1 } })
    const unsorted = moveCopies(input, bolt, 'p1', 'unsorted', 1)
    expect(unsorted.assign).toEqual({ [bolt]: { unsorted: 1 } })
    expect(moveCopies(unsorted, bolt, 'unsorted', 'p1', 1).assign).toEqual({ [bolt]: { p1: 1 } })
  })

  it('DCK-7: moveCopies moves nothing from a pile that holds no copy, or within the same pile', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p1: 2 } })
    expect(moveCopies(input, bolt, 'p2', 'p1', 1)).toBe(input)
    expect(moveCopies(input, bolt, 'p1', 'p1', 1)).toBe(input)
  })

  it('DCK-7: addCopies adds a new copy to a pile, and takeCopies removes one from a place', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p1: 1 } })
    expect(addCopies(input, bolt, 'p2', 1).assign).toEqual({ [bolt]: { p1: 1, p2: 1 } })
    expect(addCopies(input, bolt, 'nope', 1).assign).toEqual({ [bolt]: { p1: 1, unsorted: 1 } })
    expect(takeCopies(input, bolt, 'p1', 1).assign).toEqual({})
    expect(takeCopies(input, bolt, 'p2', 1)).toBe(input)
  })

  it('DCK-7: assignAllCopies puts every copy in one pile, or in Unsorted for an unknown pile', () => {
    const input = sp([{ id: 'p1', label: 'A' }, { id: 'p2', label: 'B' }], { [bolt]: { p1: 1, p2: 3 } })
    expect(assignAllCopies(input, bolt, 'p2', 4).assign).toEqual({ [bolt]: { p2: 4 } })
    expect(assignAllCopies(input, bolt, 'unsorted', 4).assign).toEqual({ [bolt]: { unsorted: 4 } })
    expect(assignAllCopies(input, bolt, 'nope', 4).assign).toEqual({ [bolt]: { unsorted: 4 } })
  })

  it('DCK-7: pruneStackPiles drops the assignments of cards no longer in the deck', () => {
    const input = sp([{ id: 'p1', label: 'A' }], { [bolt]: { p1: 1 }, [angel]: { p1: 2 } })
    const pruned = pruneStackPiles(input, [card('Bolt')])
    expect(pruned.assign).toEqual({ [bolt]: { p1: 1 } })
    expect(pruned.piles).toEqual(input.piles)
  })
})
