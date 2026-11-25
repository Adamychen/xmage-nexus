import { describe, expect, it } from 'vitest'
import { chipReserve, chipSignature } from './chipReserve'

describe('chipReserve', () => {
  it('BRD-32: creatures reaching the chip in height make room for it, creatures below it do not', () => {
    expect(chipReserve({ reservedFor: null, signature: 'a', cardsTop: 60, chipBottom: 90, stableFrames: 2 })).toEqual({ reserve: true, reservedFor: 'a', recheck: false })
    expect(chipReserve({ reservedFor: null, signature: 'a', cardsTop: 95, chipBottom: 90, stableFrames: 2 })).toEqual({ reserve: false, reservedFor: null, recheck: false })
    expect(chipReserve({ reservedFor: null, signature: 'a', cardsTop: Infinity, chipBottom: 90, stableFrames: 2 })).toEqual({ reserve: false, reservedFor: null, recheck: false })
  })

  it('BRD-21: while the zone keeps its size the reserve holds, even when the cards it shrank no longer reach the chip', () => {
    expect(chipReserve({ reservedFor: 'a', signature: 'a', cardsTop: 120, chipBottom: 90, stableFrames: 2 })).toEqual({ reserve: true, reservedFor: 'a', recheck: false })
  })

  it('BRD-21: a reserve made for one size is dropped when the zone changes, so the next measure reads the board without it', () => {
    const resized = chipReserve({ reservedFor: 'a', signature: 'b', cardsTop: 60, chipBottom: 90, stableFrames: 2 })
    expect(resized).toEqual({ reserve: false, reservedFor: null, recheck: false })
    expect(chipReserve({ reservedFor: resized.reservedFor, signature: 'b', cardsTop: 95, chipBottom: 90, stableFrames: 2 })).toEqual({ reserve: false, reservedFor: null, recheck: false })
  })

  it('BRD-21: a clock tick inside the chip does not change the signature, so the row never jumps a chip wide', () => {
    const board = { zoneW: 1200, zoneH: 420, chipW: 136, chipH: 64, cards: 6 }
    // A tick re-renders the timer and its measured width moves by a pixel or two.
    expect(chipSignature({ ...board, chipW: 137 })).toBe(chipSignature(board))
    expect(chipSignature({ ...board, chipW: 134 })).toBe(chipSignature(board))
    expect(chipSignature({ ...board, chipH: 65 })).toBe(chipSignature(board))
    // A scrollbar or a sub-pixel reflow of the zone is not a new board either.
    expect(chipSignature({ ...board, zoneW: 1202 })).toBe(chipSignature(board))
  })

  it('BRD-21: a real change still asks the question again', () => {
    const board = { zoneW: 1200, zoneH: 420, chipW: 136, chipH: 64, cards: 6 }
    expect(chipSignature({ ...board, cards: 7 })).not.toBe(chipSignature(board))
    expect(chipSignature({ ...board, zoneW: 1000 })).not.toBe(chipSignature(board))
    expect(chipSignature({ ...board, zoneH: 300 })).not.toBe(chipSignature(board))
    expect(chipSignature({ ...board, chipW: 180 })).not.toBe(chipSignature(board))
  })

  it('BRD-21: cards still drawn at the old size never turn the reserve on; it waits for two frames of the same board', () => {
    expect(chipReserve({ reservedFor: null, signature: 'b', cardsTop: 60, chipBottom: 90, stableFrames: 0 })).toEqual({ reserve: false, reservedFor: null, recheck: true })
    expect(chipReserve({ reservedFor: null, signature: 'b', cardsTop: 60, chipBottom: 90, stableFrames: 1 })).toEqual({ reserve: false, reservedFor: null, recheck: true })
    expect(chipReserve({ reservedFor: null, signature: 'b', cardsTop: 60, chipBottom: 90, stableFrames: 2 })).toEqual({ reserve: true, reservedFor: 'b', recheck: false })
  })
})
