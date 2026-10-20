import { describe, expect, it } from 'vitest'
import { libraryLevel, libraryRanOut } from './libraryRunOut'

describe('libraryRunOut', () => {
  it('turns red at three cards or fewer and stays quiet above', () => {
    expect(libraryLevel(40)).toBe('ok')
    expect(libraryLevel(4)).toBe('ok')
    expect(libraryLevel(3)).toBe('low')
    expect(libraryLevel(1)).toBe('low')
    expect(libraryLevel(0)).toBe('empty')
    expect(libraryLevel(undefined)).toBe('ok')
  })

  it('cracks only when the library empties between two views', () => {
    expect(libraryRanOut(1, 0)).toBe(true)
    expect(libraryRanOut(5, 0)).toBe(true)
    expect(libraryRanOut(null, 0)).toBe(false)
    expect(libraryRanOut(0, 0)).toBe(false)
    expect(libraryRanOut(3, 2)).toBe(false)
    expect(libraryRanOut(0, 2)).toBe(false)
  })
})
