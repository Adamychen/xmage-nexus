import { describe, expect, it } from 'vitest'
import { cardsContainTarget, resolveTargetHits, targetZoneKindOf } from './targetZones'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

describe('targetZoneKindOf', () => {
  it('maps the engine Zone names HumanPlayer.getOptions sends as targetZone', () => {
    expect(targetZoneKindOf('HAND')).toBe('hand')
    expect(targetZoneKindOf('GRAVEYARD')).toBe('graveyard')
    expect(targetZoneKindOf('EXILED')).toBe('exile')
    expect(targetZoneKindOf('LIBRARY')).toBe('library')
    expect(targetZoneKindOf('BATTLEFIELD')).toBe('battlefield')
    expect(targetZoneKindOf('STACK')).toBe('stack')
    expect(targetZoneKindOf('COMMAND')).toBe('command')
    expect(targetZoneKindOf('OUTSIDE')).toBe('sideboard')
  })

  it('leaves ALL / null / unknown zones unmapped (nothing meaningful to highlight)', () => {
    expect(targetZoneKindOf('ALL')).toBeNull()
    expect(targetZoneKindOf(null)).toBeNull()
    expect(targetZoneKindOf(undefined)).toBeNull()
    expect(targetZoneKindOf('WHATEVER')).toBeNull()
  })
})

describe('resolveTargetHits', () => {
  const game = makeGameView({
    myPlayerId: 'p1',
    myHand: { 'h-1': makeCard({ name: 'Counterspell', parentId: 'h-1' }) },
    stack: { 's-1': makeCard({ name: 'Lightning Bolt', parentId: 's-1' }) },
    opponentHands: { Bob: { 'oh-1': { id: 'oh-1' } } },
    watchedHands: { Carol: { 'wh-1': { id: 'wh-1' } } },
    revealed: [{ name: 'Bob', cards: { 'rev-1': makeCard({ name: 'Duress', parentId: 'rev-1' }) } }],
    players: [
      makePlayer({
        playerId: 'p1',
        name: 'Alice',
        controlled: true,
        battlefield: { 'perm-1': makePermanent({ name: 'Serra Angel', parentId: 'perm-1' }) },
        graveyard: { 'g-1': makeCard({ name: 'Reanimate', parentId: 'g-1' }) },
        exile: { 'e-1': makeCard({ name: 'Force of Will', parentId: 'e-1' }) },
        topCard: makeCard({ id: 'lib-1', name: 'Opt', parentId: 'lib-1' }),
        commandList: [{ id: 'cmd-1', name: 'Krenko, Mob Boss' }],
      }),
      makePlayer({
        playerId: 'p2',
        name: 'Bob',
        battlefield: { 'perm-2': makePermanent({ name: 'Grizzly Bears', parentId: 'perm-2' }) },
        graveyard: { 'g-2': makeCard({ name: 'Snapcaster Mage', parentId: 'g-2' }) },
      }),
    ],
  })

  it('marks every card zone and its owner', () => {
    const hits = resolveTargetHits(game, [
      'h-1', 's-1', 'perm-1', 'g-1', 'e-1', 'lib-1', 'cmd-1',
      'perm-2', 'g-2', 'oh-1', 'wh-1', 'rev-1',
    ])
    expect(hits.zones).toEqual(
      new Set(['hand', 'stack', 'battlefield', 'graveyard', 'exile', 'library', 'command', 'revealed']),
    )
    expect(hits.owners).toEqual(new Set(['p1', 'p2', 'Carol']))
  })

  it('resolves the owner from the hand views so the right hand highlights', () => {
    const oppHand = resolveTargetHits(game, ['oh-1'])
    expect(oppHand.zones.has('hand')).toBe(true)
    expect(oppHand.owners.has('p2')).toBe(true)

    const myHand = resolveTargetHits(game, ['h-1'])
    expect(myHand.owners.has('p1')).toBe(true)
  })

  it('ignores player targets (no zone owns a player id)', () => {
    const hits = resolveTargetHits(game, ['p1', 'p2'])
    expect(hits.zones.size).toBe(0)
    expect(hits.owners.size).toBe(0)
  })

  it('returns empty hits without a game or ids', () => {
    expect(resolveTargetHits(null, ['g-1']).zones.size).toBe(0)
    expect(resolveTargetHits(game, []).zones.size).toBe(0)
  })
})

describe('cardsContainTarget', () => {
  it('matches by map key, card id and parentId', () => {
    const cards = {
      'key-1': makeCard({ id: 'card-1', name: 'Opt', parentId: 'parent-1' }),
    }
    expect(cardsContainTarget(cards, new Set(['key-1']))).toBe(true)
    expect(cardsContainTarget(cards, new Set(['card-1']))).toBe(true)
    expect(cardsContainTarget(cards, new Set(['parent-1']))).toBe(true)
    expect(cardsContainTarget(cards, new Set(['nope']))).toBe(false)
    expect(cardsContainTarget(undefined, new Set(['key-1']))).toBe(false)
  })
})
