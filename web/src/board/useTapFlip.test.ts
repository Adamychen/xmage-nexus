import { describe, expect, it } from 'vitest'
import { settledCentre, translateOffset } from './useTapFlip'

const rect = (left: number, top: number) => ({ left, top, width: 100, height: 140 })

describe('the position a tap slide starts from', () => {
  it('FX-16: a card carrying no slide is read where it is', () => {
    expect(translateOffset('none')).toEqual({ x: 0, y: 0 })
    expect(translateOffset('')).toEqual({ x: 0, y: 0 })
    expect(settledCentre(rect(200, 100), 'none')).toEqual({ x: 250, y: 170 })
  })

  it('FX-16: a slide in the air is taken back out, so the reference is the place the layout gave', () => {
    expect(translateOffset('12px 4px')).toEqual({ x: 12, y: 4 })
    expect(translateOffset('-8px')).toEqual({ x: -8, y: 0 })
    // Mid-animation the card sits 30px to the left of its slot: its settled centre is still the slot's.
    expect(settledCentre(rect(170, 100), '-30px 0px')).toEqual({ x: 250, y: 170 })
    // An attacker holds a 12px lunge of its own (CSS, not this FLIP), which is not a change of place.
    expect(settledCentre(rect(200, 88), '0px -12px')).toEqual({ x: 250, y: 170 })
  })

  it('FX-16: an offset written in other units or units it cannot read counts as none', () => {
    expect(translateOffset('calc(1rem + 2px)')).toEqual({ x: 0, y: 0 })
    expect(settledCentre(rect(200, 100), 'calc(1rem + 2px)')).toEqual({ x: 250, y: 170 })
  })
})
