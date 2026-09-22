import { describe, expect, it } from 'vitest'
import { groupAdjacent } from './groupAdjacent'

describe('groupAdjacent', () => {
  it('agrupa solo elementos consecutivos con la misma firma y conserva el índice de inicio', () => {
    const groups = groupAdjacent(['a', 'a', 'b', 'a', 'a', 'a'], (x) => x)
    expect(groups.map((g) => g.items)).toEqual([['a', 'a'], ['b'], ['a', 'a', 'a']])
    expect(groups.map((g) => g.start)).toEqual([0, 2, 3])
  })

  it('una firma nula nunca se agrupa, ni siquiera con otra nula', () => {
    const groups = groupAdjacent(['x', 'x', 'x'], () => null)
    expect(groups.map((g) => g.items.length)).toEqual([1, 1, 1])
    expect(groups.map((g) => g.start)).toEqual([0, 1, 2])
  })

  it('lista vacía → sin grupos', () => {
    expect(groupAdjacent([], () => 'k')).toEqual([])
  })
})
