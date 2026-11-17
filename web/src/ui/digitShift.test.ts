import { describe, expect, it } from 'vitest'
import { measureDigitShift } from './digitShift'

describe('BRD-55: lifting a number onto the middle of its badge', () => {
  it('BRD-55: the lift is the slack the line box leaves above the digits, as a share of the size', () => {
    const canvas = {
      getContext: () => ({
        font: '',
        measureText: () => ({
          fontBoundingBoxAscent: 108,
          fontBoundingBoxDescent: 25,
          actualBoundingBoxAscent: 71,
          actualBoundingBoxDescent: 1,
        }),
      }),
    }
    const original = document.createElement
    document.createElement = ((tag: string) => (tag === 'canvas' ? canvas : original.call(document, tag))) as typeof document.createElement
    try {
      // box centre 41.5 above the baseline, ink centre 35: the number has to come up 6.5 of 100.
      expect(measureDigitShift('800 100px Test')).toBeCloseTo(0.065, 4)
    } finally {
      document.createElement = original
    }
  })

  it('BRD-55: a font that says nothing useful moves the number not at all', () => {
    expect(measureDigitShift('')).toBe(0)
  })
})
