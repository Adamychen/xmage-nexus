import { describe, expect, it } from 'vitest'
import type { PermanentView } from '../net/types'
import { isMarqueePermanent } from './marquee'

function perm(extra: Partial<PermanentView>): PermanentView {
  return { name: 'X', manaValue: 0, expansionSetCode: 'T', cardNumber: '0', ...extra }
}

describe('isMarqueePermanent', () => {
  it('matches sagas, planeswalkers and battles by type', () => {
    expect(isMarqueePermanent(perm({ cardTypes: ['Enchantment', 'Saga'] }))).toBe(true)
    expect(isMarqueePermanent(perm({ cardTypes: ['Planeswalker'] }))).toBe(true)
    expect(isMarqueePermanent(perm({ cardTypes: ['Battle', 'Siege'] }))).toBe(true)
  })

  it('is case-insensitive and falls back to mageObjectType', () => {
    expect(isMarqueePermanent(perm({ cardTypes: ['SAGA'] }))).toBe(true)
    expect(isMarqueePermanent(perm({ cardTypes: ['Other'], mageObjectType: 'PLANESWALKER' }))).toBe(true)
  })

  it('rejects lands, artifacts and creatures (even saga creatures)', () => {
    expect(isMarqueePermanent(perm({ cardTypes: ['Land'] }))).toBe(false)
    expect(isMarqueePermanent(perm({ cardTypes: ['Artifact'] }))).toBe(false)
    expect(isMarqueePermanent(perm({ cardTypes: ['Creature'] }))).toBe(false)
    expect(isMarqueePermanent(perm({ cardTypes: ['Enchantment', 'Creature', 'Saga'] }))).toBe(false)
  })
})
