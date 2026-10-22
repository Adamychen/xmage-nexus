import { describe, it, expect } from 'vitest'
import { switchableHandKeys } from './handSwitch'

describe('handSwitch', () => {
  it('HND-10: returns nothing when no hand is sent', () => {
    expect(switchableHandKeys(undefined)).toEqual([])
    expect(switchableHandKeys({})).toEqual([])
  })
  it('HND-10: ignores empty hands', () => {
    expect(switchableHandKeys({ Bob: {}, Carol: { 'c1': { id: 'c1' } } })).toEqual(['Carol'])
  })
  it('HND-10: returns every hand that has cards', () => {
    expect(
      switchableHandKeys({ Bob: { 'c1': {} }, Carol: { 'c2': {} } }),
    ).toEqual(['Bob', 'Carol'])
  })
})
