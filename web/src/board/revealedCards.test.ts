import { describe, expect, it } from 'vitest'
import { opponentRevealedCards } from './revealedCards'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

const me = makePlayer({ playerId: 'p1', name: 'Alice', controlled: true })
const bob = makePlayer({ playerId: 'p2', name: 'Bob', handCount: 3 })
const carol = makePlayer({ playerId: 'p3', name: 'Carol', handCount: 3 })

const bolt = makeCard({ id: 'r1', name: 'Lightning Bolt', expansionSetCode: 'LEA', cardNumber: '161' })
const shock = makeCard({ id: 'r2', name: 'Shock', expansionSetCode: 'M21', cardNumber: '159' })
const simple = (id: string) => ({ id, expansionSetCode: 'M10', cardNumber: '146', usesVariousArt: false, gameObject: false })

describe('opponentRevealedCards', () => {
  it("HND-13: a revealed window that is not a hand lands in no opponent's hand", () => {
    // What a library reveal sends: the window is named after its source, never after a hand
    // (`CardUtil.createObjectRelatedWindowTitle`), and `GameView.revealed` is global, so every
    // player in the pod gets the same window.
    const game = makeGameView({ players: [me, bob, carol], revealed: [{ name: 'Bloodbraid Elf [1]', cards: { r1: bolt, r2: shock } }] })
    expect(opponentRevealedCards(game, bob)).toEqual({})
    expect(opponentRevealedCards(game, carol)).toEqual({})
  })

  it("HND-13: Telepathy's hand window fills only the hand it is named for", () => {
    const game = makeGameView({ players: [me, bob, carol], revealed: [{ name: "Cards in Bob's hand", cards: { r1: bolt, r2: shock } }] })
    expect(Object.keys(opponentRevealedCards(game, bob))).toEqual(['r1', 'r2'])
    expect(opponentRevealedCards(game, carol)).toEqual({})
  })

  it('HND-13: a hand you control and a hand you watch still show, by name or by id', () => {
    const controlled = makeGameView({ players: [me, bob], opponentHands: { Bob: { h1: simple('h1') } } as unknown as GameView['opponentHands'] })
    expect(Object.keys(opponentRevealedCards(controlled, bob))).toEqual(['h1'])
    const byId = makeGameView({ players: [me, bob], opponentHands: { p2: { h1: simple('h1') } } as unknown as GameView['opponentHands'] })
    expect(Object.keys(opponentRevealedCards(byId, bob))).toEqual(['h1'])
    const watched = makeGameView({ players: [me, bob], watchedHands: { Bob: { h1: simple('h1') } } as unknown as GameView['watchedHands'] })
    const card = opponentRevealedCards(watched, bob).h1
    expect(card.expansionSetCode).toBe('M10')
    expect(card.cardNumber).toBe('146')
  })
})
