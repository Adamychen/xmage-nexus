import { afterEach, describe, expect, it } from 'vitest'
import { clearFizzled, consumeFizzled, fizzledSpellId, noteFizzled, parseFizzle } from './fizzleFx'

describe('parseFizzle', () => {
  it('reads the fizzled spell by its plain card name', () => {
    expect(parseFizzle('Lightning Bolt has been fizzled.')).toEqual({ name: 'Lightning Bolt' })
    expect(parseFizzle('Ability has been fizzled: Deal 2 damage')).toBeNull()
    expect(parseFizzle('Alice casts Lightning Bolt')).toBeNull()
  })
})

describe('fizzledSpellId', () => {
  it('finds the first matching spell on the stack, case-insensitively', () => {
    expect(fizzledSpellId({ a: { name: 'Shock' }, b: { name: 'Lightning Bolt' } }, 'lightning bolt')).toBe('b')
  })

  it('returns null without a match or without a stack', () => {
    expect(fizzledSpellId({ a: { name: 'Shock' } }, 'Lightning Bolt')).toBeNull()
    expect(fizzledSpellId(undefined, 'Lightning Bolt')).toBeNull()
  })
})

describe('fizzle note', () => {
  afterEach(() => {
    clearFizzled()
  })

  it('is consumed once for the noted spell', () => {
    noteFizzled('x')
    expect(consumeFizzled('x')).toBe(true)
    expect(consumeFizzled('x')).toBe(false)
    expect(consumeFizzled('y')).toBe(false)
  })
})
