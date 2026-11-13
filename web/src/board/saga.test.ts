import { describe, expect, it } from 'vitest'
import { intToRoman, isSaga, romanToInt, sagaChapter, sagaChapters } from './saga'
import type { CardView, PermanentView } from '../net/types'

const BENALIA = [
  '<i>(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)</i> ',
  'I, II - Create a 2/2 white Knight creature token with vigilance.',
  'III - Knights you control get +2/+1 until end of turn.',
]

const ELDEST = [
  '<i>(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.)</i>',
  'I — Each opponent sacrifices a creature or planeswalker.',
  'II — Each opponent discards a card.',
  'III — Return target creature card from your graveyard to the battlefield.',
  'IV — You draw a card.',
]

describe('saga chapters', () => {
  it('BRD-44: reads the chapter count from the chapter rows, however many there are', () => {
    expect(sagaChapters({ rules: BENALIA } as unknown as CardView)).toBe(3)
    expect(sagaChapters({ rules: ELDEST } as unknown as CardView)).toBe(4)
    expect(sagaChapters({ rules: [...ELDEST, 'V — Draw two cards.'] } as unknown as CardView)).toBe(5)
  })

  it('BRD-44: falls back to the reminder text, and to three when the rules say nothing', () => {
    expect(sagaChapters({ rules: ['<i>(Sacrifice after IV.)</i>'] } as unknown as CardView)).toBe(4)
    expect(sagaChapters({ rules: [] } as unknown as CardView)).toBe(3)
    expect(sagaChapters({} as unknown as CardView)).toBe(3)
  })

  it('BRD-44: the chapter it is on is its lore counter', () => {
    expect(sagaChapter({ counters: [{ name: 'lore', count: 2 }] } as unknown as PermanentView)).toBe(2)
    expect(sagaChapter({ counters: [{ name: 'LORE', count: 4 }] } as unknown as PermanentView)).toBe(4)
    expect(sagaChapter({ counters: [{ name: '+1/+1', count: 2 }] } as unknown as PermanentView)).toBe(0)
    expect(sagaChapter({} as unknown as PermanentView)).toBe(0)
  })

  it('BRD-44: a saga is one by subtype, whatever the case', () => {
    expect(isSaga({ subTypes: ['SAGA'] } as unknown as CardView)).toBe(true)
    expect(isSaga({ subTypes: ['Saga'] } as unknown as CardView)).toBe(true)
    expect(isSaga({ subTypes: ['AURA'] } as unknown as CardView)).toBe(false)
    expect(isSaga({} as unknown as CardView)).toBe(false)
  })

  it('BRD-44: roman numerals go both ways', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10].map(intToRoman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'IX', 'X'])
    expect(['I', 'II', 'III', 'IV', 'V', 'VI', 'IX', 'X'].map(romanToInt)).toEqual([1, 2, 3, 4, 5, 6, 9, 10])
    expect(romanToInt('nope')).toBe(0)
  })
})
