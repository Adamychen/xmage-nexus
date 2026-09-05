import { describe, expect, it } from 'vitest'
import { DEFAULT_MANA_PAYMENT, loadManaPayment, saveManaPayment } from '../state/persistence'
import { manaPaymentActions, manaTypeOf, poolTotal, shouldConfirmEmptyPool } from './manaPayment'

describe('manaPayment (pure)', () => {
  it('maps settings to the 3 server actions', () => {
    expect(manaPaymentActions({ auto: true, restricted: true, useFirstAbility: false, confirmEmptyPool: true })).toEqual([
      'MANA_AUTO_PAYMENT_ON',
      'MANA_AUTO_PAYMENT_RESTRICTED_ON',
      'USE_FIRST_MANA_ABILITY_OFF',
    ])
    expect(manaPaymentActions({ auto: false, restricted: false, useFirstAbility: true, confirmEmptyPool: false })).toEqual([
      'MANA_AUTO_PAYMENT_OFF',
      'MANA_AUTO_PAYMENT_RESTRICTED_OFF',
      'USE_FIRST_MANA_ABILITY_ON',
    ])
  })

  it('maps pool keys to server ManaType names', () => {
    expect(manaTypeOf('white')).toBe('WHITE')
    expect(manaTypeOf('blue')).toBe('BLUE')
    expect(manaTypeOf('black')).toBe('BLACK')
    expect(manaTypeOf('red')).toBe('RED')
    expect(manaTypeOf('green')).toBe('GREEN')
    expect(manaTypeOf('colorless')).toBe('COLORLESS')
    expect(manaTypeOf('generic')).toBeNull()
    expect(manaTypeOf('')).toBeNull()
  })

  it('totals only the six pool colors', () => {
    expect(poolTotal({ red: 2, green: 1, blue: 0, white: 0, black: 0, colorless: 0 })).toBe(3)
    expect(poolTotal({})).toBe(0)
    expect(poolTotal(null)).toBe(0)
    expect(poolTotal(undefined)).toBe(0)
  })

  it('asks to confirm only with pool mana and the pref on', () => {
    const pool = { red: 1, green: 0, blue: 0, white: 0, black: 0, colorless: 0 }
    expect(shouldConfirmEmptyPool(pool, { ...DEFAULT_MANA_PAYMENT })).toBe(true)
    expect(shouldConfirmEmptyPool(pool, { ...DEFAULT_MANA_PAYMENT, confirmEmptyPool: false })).toBe(false)
    expect(shouldConfirmEmptyPool({}, { ...DEFAULT_MANA_PAYMENT })).toBe(false)
    expect(shouldConfirmEmptyPool(null, { ...DEFAULT_MANA_PAYMENT })).toBe(false)
  })

  it('persists mana payment prefs round-trip', () => {
    expect(loadManaPayment()).toEqual(DEFAULT_MANA_PAYMENT)
    saveManaPayment({ auto: false, restricted: false, useFirstAbility: true, confirmEmptyPool: false })
    expect(loadManaPayment()).toEqual({ auto: false, restricted: false, useFirstAbility: true, confirmEmptyPool: false })
    saveManaPayment({ ...DEFAULT_MANA_PAYMENT })
    expect(loadManaPayment()).toEqual(DEFAULT_MANA_PAYMENT)
  })
})
