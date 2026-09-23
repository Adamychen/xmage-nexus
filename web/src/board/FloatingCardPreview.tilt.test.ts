import { describe, expect, it } from 'vitest'
import { foilKind, tiltFromPointer } from './FloatingCardPreview'

describe('preview foil and tilt', () => {
  it('only foils rares and mythics', () => {
    expect(foilKind('MYTHIC')).toBe('mythic')
    expect(foilKind('RARE')).toBe('rare')
    expect(foilKind('COMMON')).toBeNull()
    expect(foilKind(undefined)).toBeNull()
  })

  it('tilts towards the pointer and centres the glare on it', () => {
    const rect = { left: 100, top: 100, width: 100, height: 140 }
    expect(tiltFromPointer(150, 170, rect)).toEqual({ rx: 0, ry: 0, gx: 50, gy: 50 })
    const corner = tiltFromPointer(200, 100, rect)
    expect(corner).toEqual({ rx: 8, ry: 10, gx: 100, gy: 0 })
    expect(tiltFromPointer(-500, 900, rect)).toEqual({ rx: -8, ry: -10, gx: 0, gy: 100 })
  })
})
