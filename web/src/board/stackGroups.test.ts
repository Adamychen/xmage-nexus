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

  it('BRD-20: creature tokens that cannot act yet make a pile of their own, and join the rest when they can', () => {
    const sick = Array.from({ length: 17 }, () => creatureToken('Goblin', { summoningSickness: true }))
    const ready = Array.from({ length: 7 }, () => creatureToken('Goblin'))
    const mixed = groupStackables(entries([...ready, ...sick]), 'creatures')
    expect(mixed.groups.map((g) => g.items.length)).toEqual([7, 17])
    expect(new Set(mixed.groups.map((g) => g.key)).size).toBe(2)

    const nextTurn = groupStackables(entries([...ready, ...sick.map((p) => ({ ...p, summoningSickness: false }))]), 'creatures')
    expect(nextTurn.groups.map((g) => g.items.length)).toEqual([24])
  })

  it('BRD-20: a pump splits the pile by power and toughness', () => {
    const pumped = Array.from({ length: 7 }, () => creatureToken('Goblin', { power: '2' }))
    const plain = Array.from({ length: 8 }, () => creatureToken('Goblin'))
    const { groups } = groupStackables(entries([...plain, ...pumped]), 'creatures')
    expect(groups.map((g) => g.items.length)).toEqual([8, 7])
  })

  it('BRD-20: a pile holds every identical copy, however many there are', () => {
    const twelve = groupStackables(entries(Array.from({ length: 12 }, () => token('Treasure'))), 'other')
    expect(twelve.groups.map((g) => g.items.length)).toEqual([12])
    expect(twelve.solos).toHaveLength(0)

    const fifty = groupStackables(entries(Array.from({ length: 50 }, () => creatureToken('Soldier'))), 'creatures')
    expect(fifty.groups.map((g) => g.items.length)).toEqual([50])
    expect(fifty.solos).toHaveLength(0)
  })

  it('BRD-20: a land pile holds every copy too', () => {
    const { groups, solos } = groupStackables(entries(Array.from({ length: 9 }, () => land('Forest'))), 'lands')
    expect(groups.map((g) => g.items.length)).toEqual([9])
    expect(solos).toHaveLength(0)
  })

  it('BRD-20: a copy the game asks the player to pick leaves the pile and stands on its own', () => {
    const perms = entries(Array.from({ length: 8 }, () => token('Treasure')))
    const { groups, solos } = groupStackables(perms, 'other', { excludeIds: new Set(['c3']) })
    expect(groups.map((g) => g.items.length)).toEqual([7])
    expect(solos.map(([id]) => id)).toEqual(['c3'])
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

  it('BRD-28: a token with an attachment or a mutated permanent is never piled, it stays a solo card', () => {
    const equipped = creatureToken('Soldier', { attachments: ['sword'] })
    const mutated = creatureToken('Soldier', { mutated: true })
    expect(stackGroupKeyOf('x', equipped, 'creatures')).toBeNull()
    expect(stackGroupKeyOf('x', mutated, 'creatures')).toBeNull()
    expect(stackGroupKeyOf('x', { ...token('Treasure'), attachments: ['aura'] }, 'other')).toBeNull()
    expect(stackGroupKeyOf('x', { ...land('Forest'), attachments: ['aura'] }, 'lands')).toBeNull()
    const perms = [creatureToken('Soldier'), creatureToken('Soldier'), creatureToken('Soldier'), creatureToken('Soldier'), equipped]
    const { groups, solos } = groupStackables(entries(perms), 'creatures')
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(4)
    expect(solos.map(([, p]) => p.attachments)).toEqual([['sword']])
  })
})

describe('BRD-32: lands of the own Arena board pile from two', () => {
  it('BRD-32: two identical lands pile up with min 2 and stay apart by default', () => {
    const pair = entries([land('Forest'), land('Forest')])
    expect(groupStackables(pair, 'lands').groups).toHaveLength(0)
    const { groups, solos } = groupStackables(pair, 'lands', { min: 2 })
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(2)
    expect(solos).toHaveLength(0)
  })
})
