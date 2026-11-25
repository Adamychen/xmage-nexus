import { describe, expect, it } from 'vitest'
import { HAND_LAYOUTS, HAND_LAYOUT_PREVIEW, handLayoutFlags, handLayoutOf } from './handLayout'

describe('how the hand is drawn', () => {
  it('SET-16: the three shapes are the fan, the column and the row, and the fan comes first', () => {
    expect([...HAND_LAYOUTS]).toEqual(['fan', 'column', 'row'])
  })

  it('SET-16: a player who has set nothing gets the fan', () => {
    expect(handLayoutOf({ handRail: false, handRow: false })).toBe('fan')
  })

  it('SET-16: each flag names its own shape', () => {
    expect(handLayoutOf({ handRail: true, handRow: false })).toBe('column')
    expect(handLayoutOf({ handRail: false, handRow: true })).toBe('row')
  })

  it('SET-16: a setting saved with both flags on reads as the column, which is what the board draws', () => {
    expect(handLayoutOf({ handRail: true, handRow: true })).toBe('column')
  })

  it('SET-16: picking a shape writes a pair that cannot say two things at once', () => {
    for (const layout of HAND_LAYOUTS) {
      const flags = handLayoutFlags(layout)
      expect(flags.handRail && flags.handRow, `${layout} turns on both flags`).toBe(false)
      expect(handLayoutOf(flags), `${layout} does not read back as itself`).toBe(layout)
    }
  })

  it('SET-16: every shape is shown with a thumbnail of its own', () => {
    const kinds = HAND_LAYOUTS.map((layout) => HAND_LAYOUT_PREVIEW[layout])
    expect(kinds).toEqual(['handFan', 'handRail', 'handRow'])
    expect(new Set(kinds).size).toBe(kinds.length)
  })
})
