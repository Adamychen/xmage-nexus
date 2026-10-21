import { describe, expect, it } from 'vitest'
import { parseBehold } from './beholdFx'

describe('parseBehold', () => {
  it('reads the beheld permanent from the single-permanent line', () => {
    const line = "<font color='#20B2AA'>Alice</font> chooses to behold <font color='#B0C4DE' object_id='11111111-2222-3333-4444-555555555555'>Ancient Dragon</font> [111]"
    expect(parseBehold(line)).toEqual({ objectId: '11111111-2222-3333-4444-555555555555' })
  })

  it('ignores the type-only form and every other line', () => {
    expect(parseBehold("<font color='#20B2AA'>Alice</font> chooses to behold a Dragon from the battlefield")).toBeNull()
    expect(parseBehold('Alice casts Opt')).toBeNull()
  })
})
