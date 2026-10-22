import { describe, expect, it } from 'vitest'
import type { PermanentView } from '../net/types'
import { groupStackables, STACK_GROUP_MIN, stackGroupKeyOf } from './stackGroups'

function land(name: string, extra: Partial<PermanentView> = {}): PermanentView {
  return { name, cardTypes: ['Land'], manaValue: 0, expansionSetCode: 'T', cardNumber: '0', ...extra }
}

function token(name: string, extra: Partial<PermanentView> = {}): PermanentView {
  return {
    name,
    cardTypes: ['Artifact'],
    manaValue: 0,
    expansionSetCode: 'T',
    cardNumber: '0',
    isToken: true,
    ...extra,
  }
}

function creatureToken(name: string, extra: Partial<PermanentView> = {}): PermanentView {
  return {
    name,
    cardTypes: ['Creature'],
    power: '1',
    toughness: '1',
    manaValue: 0,
    expansionSetCode: 'T',
    cardNumber: '0',
    isToken: true,
    ...extra,
  }
}

function entries(perms: PermanentView[]): [string, PermanentView][] {
  return perms.map((p, i) => [`c${i}`, p])
}

describe('stackGroupKeyOf', () => {
  it('lands group by name and tapped state', () => {
    const a = stackGroupKeyOf('x', land('Island'), 'lands')
    const b = stackGroupKeyOf('y', land('Island'), 'lands')
    const c = stackGroupKeyOf('z', land('Island', { tapped: true }), 'lands')
    expect(a?.key).toBe(b?.key)
    expect(a?.key).not.toBe(c?.key)
    expect(a?.groupKind).toBe('land')
  })

  it('non-token non-lands never stack', () => {
    const ring = token('Sol Ring', { isToken: false, mageObjectType: undefined })
    expect(stackGroupKeyOf('x', ring, 'other')).toBeNull()
    const bear = creatureToken('Grizzly Bears', { isToken: false, mageObjectType: undefined })
    expect(stackGroupKeyOf('x', bear, 'creatures')).toBeNull()
  })

  it('tokens split by tapped state', () => {
    const a = stackGroupKeyOf('x', token('Treasure'), 'other')
    const b = stackGroupKeyOf('y', token('Treasure', { tapped: true }), 'other')
    expect(a?.key).not.toBe(b?.key)
    expect(a?.groupKind).toBe('token')
  })

  it('creature tokens split by power/toughness', () => {
    const a = stackGroupKeyOf('x', creatureToken('Soldier'), 'creatures')
    const b = stackGroupKeyOf('y', creatureToken('Soldier', { power: '2', toughness: '2' }), 'creatures')
    expect(a?.key).not.toBe(b?.key)
    expect(a?.groupKind).toBe('creature-token')
  })

  it('excludes damaged, countered, busy, morphed and mutated tokens', () => {
    const base = creatureToken('Soldier')
    expect(stackGroupKeyOf('x', base, 'creatures', new Set(['x']))).toBeNull()
    expect(stackGroupKeyOf('x', { ...base, damage: 1 }, 'creatures')).toBeNull()
    expect(stackGroupKeyOf('x', { ...base, counters: [{ name: '+1/+1', count: 1 }] }, 'creatures')).toBeNull()
    expect(stackGroupKeyOf('x', { ...base, morphed: true }, 'creatures')).toBeNull()
    expect(stackGroupKeyOf('x', { ...base, faceDown: true }, 'creatures')).toBeNull()
    expect(stackGroupKeyOf('x', { ...base, mutated: true }, 'creatures')).toBeNull()
    expect(stackGroupKeyOf('x', { ...token('Treasure'), damage: 1 }, 'other')).toBeNull()
  })
})

describe('groupStackables', () => {
  it('TGT-6: keeps excluded ids (targets, busy) out of a collapsed pile for every kind', () => {
    const tokens: [string, PermanentView][] = ['a', 'b', 'c', 'd'].map((id) => [id, token('Clue')])
    const creatures: [string, PermanentView][] = ['a', 'b', 'c', 'd'].map((id) => [id, creatureToken('Soldier')])
    for (const [entries, kind] of [[tokens, 'other'], [creatures, 'creatures']] as const) {
      const { groups, solos } = groupStackables(entries, kind, { excludeIds: new Set(['b']) })
      expect(groups[0].items.map(([id]) => id)).toEqual(['a', 'c', 'd'])
      expect(solos.map(([id]) => id)).toEqual(['b'])
    }
  })
  it('splits lands into a tapped pile and an untapped pile, keeping order within each', () => {
    const { groups, solos } = groupStackables(
      entries([
        land('Swamp'),
        land('Swamp', { tapped: true }),
        land('Swamp'),
        land('Swamp', { tapped: true }),
        land('Swamp'),
        land('Swamp', { tapped: true }),
        land('Swamp', { tapped: true }),
      ]),
      'lands',
    )
    expect(groups.map((g) => g.items.map(([id]) => id))).toEqual([
      ['c0', 'c2', 'c4'],
      ['c1', 'c3', 'c5', 'c6'],
    ])
    expect(solos).toHaveLength(0)
  })

  it(`stacks from ${STACK_GROUP_MIN} but leaves pairs solo`, () => {
    const { groups, solos } = groupStackables(entries([land('Island'), land('Island')]), 'lands')
    expect(groups).toHaveLength(0)
    expect(solos).toHaveLength(2)
    const full = groupStackables(entries([land('Island'), land('Island'), land('Island')]), 'lands')
    expect(full.groups).toHaveLength(1)
    expect(full.groups[0].items).toHaveLength(3)
    expect(full.solos).toHaveLength(0)
  })

  it('keeps first-appearance order and solo order', () => {
    const { groups, solos } = groupStackables(
      entries([
        land('Mountain'),
        land('Island'),
        land('Island'),
        land('Mountain'),
        land('Island'),
        land('Plains'),
        land('Plains'),
        land('Plains'),
      ]),
      'lands',
    )
    expect(groups.map((g) => g.name)).toEqual(['Island', 'Plains'])
    expect(solos.map(([, p]) => p.name)).toEqual(['Mountain', 'Mountain'])
  })

  it('groups treasure tokens by tapped state', () => {
    const perms = [
      token('Treasure'),
      token('Treasure'),
      token('Treasure'),
      token('Treasure', { tapped: true }),
      token('Treasure', { tapped: true }),
    ]
    const { groups, solos } = groupStackables(entries(perms), 'other')
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(3)
    expect(solos).toHaveLength(2)
  })

  it('a divergent creature token stays solo while its siblings stack', () => {
    const perms = [
      creatureToken('Soldier'),
      creatureToken('Soldier'),
      creatureToken('Soldier'),
      creatureToken('Soldier', { counters: [{ name: '+1/+1', count: 1 }] }),
    ]
    const { groups, solos } = groupStackables(entries(perms), 'creatures')
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(3)
    expect(solos).toHaveLength(1)
    expect(solos[0][1].counters).toHaveLength(1)
  })
})
