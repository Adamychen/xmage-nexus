import { describe, expect, it } from 'vitest'
import { capResourceText } from '../src/resources.ts'

describe('resource text cap', () => {
  it('returns short text unchanged', () => {
    expect(capResourceText('{"ok":true}')).toBe('{"ok":true}')
  })

  it('truncates text over 200 KB and says how much was dropped', () => {
    const capped = capResourceText('a'.repeat(250_000))
    expect(capped.length < 200_100).toBe(true)
    expect(capped.startsWith('aaaa')).toBe(true)
    expect(capped.endsWith('…[truncated 50000 chars]…')).toBe(true)
  })
})
