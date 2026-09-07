import { describe, it, expect } from 'vitest'
import { switchableHandKeys } from './handSwitch'

describe('handSwitch', () => {
  it('sin manos devuelve vacío', () => {
    expect(switchableHandKeys(undefined)).toEqual([])
    expect(switchableHandKeys({})).toEqual([])
  })
  it('ignora entradas vacías', () => {
    expect(switchableHandKeys({ Bob: {}, Carol: { 'c1': { id: 'c1' } } })).toEqual(['Carol'])
  })
  it('devuelve todas las manos con cartas', () => {
    expect(
      switchableHandKeys({ Bob: { 'c1': {} }, Carol: { 'c2': {} } }),
    ).toEqual(['Bob', 'Carol'])
  })
})
