import { describe, expect, it } from 'vitest'
import { orderPicks, placeInZone } from './draftPickZones'

describe('draftPickZones', () => {
  it('TRN-21: a new pick lands at the end of the deck unless placed', () => {
    expect(orderPicks(['b', 'a'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
    expect(orderPicks(['x', 'a'], ['a'])).toEqual(['a'])
  })

  it('TRN-21: a dropped pick goes before the card at the drop index of its zone', () => {
    const hidden = new Set(['s1', 's2'])
    const order = ['d1', 's1', 'd2', 's2', 'd3']
    expect(placeInZone(order, hidden, 'd3', 'deck', 0)).toEqual(['d3', 'd1', 's1', 'd2', 's2'])
    expect(placeInZone(order, hidden, 'd1', 'side', 1)).toEqual(['s1', 'd2', 'd1', 's2', 'd3'])
    expect(placeInZone(order, hidden, 'd1', 'side', 9)).toEqual(['s1', 'd2', 's2', 'd1', 'd3'])
  })

  it('TRN-21: a booster card dropped in an empty zone is appended', () => {
    expect(placeInZone(['d1'], new Set(), 'new', 'side', 0)).toEqual(['d1', 'new'])
    expect(placeInZone([], new Set(), 'new', 'deck', 3)).toEqual(['new'])
  })
})
