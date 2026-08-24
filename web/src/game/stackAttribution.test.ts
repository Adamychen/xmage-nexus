import { describe, expect, it } from 'vitest'
import type { CardView, GameView } from '../net/types'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import { attributeStackControllers } from './stackAttribution'

function spell(partial: Partial<CardView> & { name: string }): CardView {
  return makeCard({ mageObjectType: 'SPELL', ...partial })
}

function ability(sourceId: string): CardView {
  return makeCard({
    name: 'Ability',
    mageObjectType: 'ABILITY_STACK_FROM_CARD',
    sourceCard: { id: sourceId } as CardView,
  })
}

function frame(players: ReturnType<typeof makePlayer>[], stack: Record<string, CardView>, priority = ''): GameView {
  return makeGameView({ players, stack, priorityPlayerName: priority, activePlayerName: '' })
}

describe('attributeStackControllers', () => {
  it('never touches entries that already carry controllerId/controllerName', () => {
    const alice = makePlayer({ playerId: 'p-a', name: 'Alice', battlefield: {} })
    const next = frame([alice], {
      s1: spell({ name: 'Bolt', id: 's1', controllerId: 'p-a' }),
      s2: spell({ name: 'Feast', id: 's2', controllerName: 'Bob' }),
    })

    attributeStackControllers(null, next)

    expect(next.stack!.s1.controllerId).toBe('p-a')
    expect(next.stack!.s1.controllerName).toBeUndefined()
    expect(next.stack!.s2.controllerName).toBe('Bob')
  })

  it('attributes abilities via sourceCard location in a player zone', () => {
    const bears = makePermanent({ name: 'Grizzly Bears', id: 'perm-1' })
    const alice = makePlayer({ playerId: 'p-a', name: 'Alice', battlefield: { 'perm-1': bears } })
    const bob = makePlayer({ playerId: 'p-b', name: 'Bob' })
    const next = frame([alice, bob], { s1: ability('perm-1') })

    attributeStackControllers(null, next)

    expect(next.stack!.s1.controllerName).toBe('Alice')
  })

  it('attributes new spells to the previous frame priority player', () => {
    const prev = frame([], {}, 'Alice')
    const next = frame([], { s1: spell({ name: 'Lightning Bolt', id: 's1' }) }, 'Alice')

    attributeStackControllers(prev, next)

    expect(next.stack!.s1.controllerName).toBe('Alice')
  })

  it('falls back to activePlayerName when priority is empty', () => {
    const prev = frame([], {})
    prev.priorityPlayerName = ''
    prev.activePlayerName = 'Bob'
    const next = frame([], { s1: spell({ name: 'Counterspell', id: 's1' }) })

    attributeStackControllers(prev, next)

    expect(next.stack!.s1.controllerName).toBe('Bob')
  })

  it('does not use priority heuristic for spells already present in the previous frame', () => {
    const existing = spell({ name: 'Remanda', id: 's1' })
    const prev = frame([], { s1: existing }, 'Alice')
    const next = frame([], { s1: spell({ name: 'Remanda', id: 's1' }) }, 'Bob')

    attributeStackControllers(prev, next)

    expect(next.stack!.s1.controllerName).toBeUndefined()
  })

  it('carries attribution forward across frames so labels persist', () => {
    const zero = frame([], {}, 'Alice')
    const first = frame([], { s1: spell({ name: 'Bolt', id: 's1' }) })
    attributeStackControllers(zero, first)
    expect(first.stack!.s1.controllerName).toBe('Alice')

    const second = frame([], { s1: spell({ name: 'Bolt', id: 's1' }) }, '')
    attributeStackControllers(first, second)
    expect(second.stack!.s1.controllerName).toBe('Alice')
  })

  it('leaves entries unnamed on the very first frame without prior data', () => {
    const next = frame([], { s1: spell({ name: 'Bolt', id: 's1' }) })

    attributeStackControllers(null, next)

    expect(next.stack!.s1.controllerName).toBeUndefined()
  })

  it('does not apply the spell heuristic to unattributed abilities without zone match', () => {
    const next = frame([], { s1: ability('unknown-source') }, 'Alice')
    const prev = frame([], {}, 'Alice')

    attributeStackControllers(prev, next)

    expect(next.stack!.s1.controllerName).toBeUndefined()
  })

  it('resolves graveyard sources too (e.g. ability from a creature in the yard)', () => {
    const yardGuy = makePermanent({ name: 'Scavenging Ooze', id: 'perm-9' })
    const bob = makePlayer({ playerId: 'p-b', name: 'Bob', graveyard: { 'perm-9': yardGuy } })
    const next = frame([bob], { s1: ability('perm-9') })

    attributeStackControllers(null, next)

    expect(next.stack!.s1.controllerName).toBe('Bob')
  })
})
