import { describe, expect, it } from 'vitest'
import { gameViewFromAndValidate } from './schema'
import { ATRAXA_COMMANDER_DECK, COMMANDER_DECKS, EDGAR_COMMANDER_DECK, MEREN_COMMANDER_DECK, SAHEELI_COMMANDER_DECK } from '../src/lobby/commanderDecks'
import { DECKS, type Deck } from '../src/lobby/decks'
import { commanderShowcaseGameView, commanderShowcasePlayableIds, SHOWCASE_PLAYERS } from '../src/__fixtures__/commanderShowcase'
import type { CardView } from '../src/net/types'

const BASICS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'])
const count = (deck: Deck) => deck.cards.reduce((n, c) => n + c.amount, 0)

describe('Commander dev decks', () => {
  it.each(COMMANDER_DECKS.map((d) => [d.name, d] as const))('TST-8: %s is a legal-size singleton Commander deck', (_name, deck) => {
    expect(deck.commanders).toHaveLength(1)
    expect(count(deck)).toBe(100)
    expect(deck.cards).toContainEqual(deck.commanders![0])
    const copies = new Map<string, number>()
    for (const c of deck.cards) copies.set(c.cardName, (copies.get(c.cardName) ?? 0) + c.amount)
    const repeated = [...copies].filter(([name, n]) => n > 1 && !BASICS.has(name))
    expect(repeated).toEqual([])
    for (const c of [...deck.cards, ...deck.commanders!]) expect(c.cardNumber).not.toBe('0')
  })

  it('TST-8: the four precons are in the dev deck list', () => {
    expect(DECKS).toEqual(expect.arrayContaining(COMMANDER_DECKS))
    expect(COMMANDER_DECKS.map((d) => d.commanders![0].cardName)).toEqual([
      "Atraxa, Praetors' Voice",
      'Saheeli, the Gifted',
      'Edgar Markov',
      'Meren of Clan Nel Toth',
    ])
  })
})

describe('Commander showcase table', () => {
  const game = commanderShowcaseGameView('Dario')
  const decks: Record<string, Deck> = {
    [SHOWCASE_PLAYERS.atraxa]: ATRAXA_COMMANDER_DECK,
    [SHOWCASE_PLAYERS.saheeli]: SAHEELI_COMMANDER_DECK,
    [SHOWCASE_PLAYERS.edgar]: EDGAR_COMMANDER_DECK,
    [SHOWCASE_PLAYERS.meren]: MEREN_COMMANDER_DECK,
  }

  it('TST-8: is a valid game view for the wire contract', () => {
    expect(gameViewFromAndValidate({ gameView: game }).errors ?? []).toEqual([])
  })

  // The one card from outside the precons: none of those years has a battle,
  // and the table has to show every permanent type the board can draw.
  const OUTSIDE_THE_PRECONS = new Set(['Invasion of Zendikar', 'History of Benalia'])

  const onTheTable = (): CardView[] =>
    (game.players ?? []).flatMap((p) => Object.values(p.battlefield ?? {}) as CardView[])

  /** The wire sends a card's types as `unknown`, so read them as the board does. */
  const typeList = (value: unknown): string[] => (Array.isArray(value) ? value.map((t) => String(t).toUpperCase()) : [])

  it('TST-8: the table shows a saga, on a chapter, so its chapters can be read', () => {
    const sagas = onTheTable().filter((c) => typeList(c.subTypes).includes('SAGA'))
    expect(sagas.map((c) => c.name)).toEqual(['History of Benalia'])
    expect(sagas[0].counters).toEqual([{ name: 'lore', count: 2 }])
    expect(sagas[0].rules?.some((r) => /III/.test(r))).toBe(true)
  })

  it('TST-8: the table shows a battle, the one permanent type the precons have none of', () => {
    const battles = onTheTable().filter((c) => typeList(c.cardTypes).includes('BATTLE'))
    expect(battles.map((c) => c.name)).toEqual(['Invasion of Zendikar'])
    expect(battles[0].defense).toBe('3')
  })

  it('TST-8: every non-token card on the table comes from its owner\'s precon, with the same printing', () => {
    for (const player of game.players ?? []) {
      const deck = decks[player.playerId]
      const printings = new Set([...deck.cards, ...deck.commanders!].map((c) => `${c.cardName}|${c.setCode}|${c.cardNumber}`))
      const cards: CardView[] = [
        ...Object.values(player.battlefield ?? {}).filter((p) => !p.isToken),
        ...Object.values(player.graveyard ?? {}),
        ...Object.values(player.exile ?? {}),
        ...(player.commandList as CardView[]),
        ...(player.controlled ? Object.values(game.myHand ?? {}) : []),
      ]
      expect(cards.length).toBeGreaterThan(10)
      const strangers = cards
        .filter((c) => !OUTSIDE_THE_PRECONS.has(c.name))
        .filter((c) => !printings.has(`${c.name}|${c.expansionSetCode}|${c.cardNumber}`))
        .map((c) => c.name)
      expect(strangers, player.name).toEqual([])
    }
  })

  it('TST-8: each commander is on the battlefield or in the command zone', () => {
    for (const player of game.players ?? []) {
      const commander = decks[player.playerId].commanders![0].cardName
      const places = [...Object.values(player.battlefield ?? {}), ...(player.commandList as CardView[])].map((c) => c.name)
      expect(places, player.name).toContain(commander)
    }
  })

  it('TST-8: it is your main phase with priority and something to play', () => {
    const me = game.players!.find((p) => p.controlled)!
    expect(me.name).toBe('Dario')
    expect(game.activePlayerId).toBe(me.playerId)
    expect(me.hasPriority).toBe(true)
    expect(commanderShowcasePlayableIds(game).length).toBeGreaterThan(0)
  })
})
