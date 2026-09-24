import { describe, expect, it } from 'vitest'
import { targetsStackObject } from './stackTargeting'

describe('targetsStackObject', () => {
  const stack = { 'spell-1': {}, 'ab-2': {} }

  it('is true when a valid target is an object on the stack', () => {
    expect(targetsStackObject(stack, ['p1', 'spell-1'])).toBe(true)
  })

  it('is false when no valid target is on the stack', () => {
    expect(targetsStackObject(stack, ['p1', 'perm-9'])).toBe(false)
  })

  it('is false with an empty or missing stack or no targets', () => {
    expect(targetsStackObject(null, ['spell-1'])).toBe(false)
    expect(targetsStackObject({}, ['spell-1'])).toBe(false)
    expect(targetsStackObject(stack, [])).toBe(false)
  })
})
