import { describe, expect, it } from 'vitest'
import { handReveals, knownHandCards } from './handRevealFx'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true })
const opp = makePlayer({ playerId: 'opp', name: 'Bob', handCount: 3 })
const simple = (id: string) => ({ id, expansionSetCode: 'M10', cardNumber: '146', usesVariousArt: false, gameObject: false })

describe('handReveals', () => {
  it('reads a watched hand that appears as revealed, keeping each card printing', () => {
    const prev = makeGameView({ players: [me, opp] })
    const next = makeGameView({ players: [me, opp], watchedHands: { Bob: { h1: simple('h1'), h2: simple('h2') } } as unknown as GameView['watchedHands'] })
    const reveals = handReveals(prev, next)
    expect(reveals.map((r) => [r.playerId, r.cards.map((c) => c.id)])).toEqual([['opp', ['h1', 'h2']]])
    expect(reveals[0].cards[0].expansionSetCode).toBe('M10')
  })

  it('a hand that grows reveals only the new cards; one already known reveals nothing', () => {
    const one = makeGameView({ players: [me, opp], opponentHands: { Bob: { h1: simple('h1') } } as unknown as GameView['opponentHands'] })
    const two = makeGameView({ players: [me, opp], opponentHands: { Bob: { h1: simple('h1'), h2: simple('h2') } } as unknown as GameView['opponentHands'] })
    expect(handReveals(one, two).flatMap((r) => r.cards.map((c) => c.id))).toEqual(['h2'])
    expect(handReveals(two, two)).toEqual([])
  })

  it("counts Telepathy's revealed group named for the player's hand, not any revealed card", () => {
    const telepathy = makeGameView({ players: [me, opp], revealed: [{ name: "Cards in Bob's hand", cards: { h1: { id: 'h1', name: 'Opt', manaValue: 1, expansionSetCode: 'XLN', cardNumber: '65' } } }] })
    const scry = makeGameView({ players: [me, opp], revealed: [{ name: 'Gitaxian Probe', cards: { t1: { id: 't1', name: 'Opt', manaValue: 1, expansionSetCode: 'XLN', cardNumber: '65' } } }] })
    expect([...knownHandCards(telepathy, opp).keys()]).toEqual(['h1'])
    expect([...knownHandCards(scry, opp).keys()]).toEqual([])
  })
})
