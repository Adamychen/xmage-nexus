import { afterEach, describe, expect, it, vi } from 'vitest'
import { castCard, primeStackEntries, stackDepartures } from './stackLinks'
import { clearCardPositionRegistry, getPreviousCardPosition, getPreviousCardZone } from './cardPositionRegistry'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

// Ids from a local 1.4.62 server (record of 2026-10-20): the card keeps its id in the hand, on the
// battlefield and in the graveyard, while the spell on the stack is keyed by its spell ability id.
const ME = '8b44ed15-1e65-46c2-827f-07c941076e83'
const MYSTIC_CARD = 'a4a1784a-e68b-426e-9903-f9d95b7bbcbc'
const MYSTIC_SPELL = '23dc62a1-90a2-479e-ba3c-ad8e9cd159fb'
const BOLT_CARD = 'c927fa19-dc9c-4a43-8986-48cc11a2a9a5'
const BOLT_SPELL = 'ccd21b07-d753-4e67-bf6a-f87982041ef4'

const mystic = (id: string) => makeCard({ id, name: 'Elvish Mystic', expansionSetCode: 'M14', cardNumber: '169', cardTypes: ['CREATURE'], controllerId: ME, parentId: undefined })
const bolt = (id: string) => makeCard({ id, name: 'Lightning Bolt', expansionSetCode: 'LEA', cardNumber: '161', cardTypes: ['INSTANT'], controllerId: ME })

describe('stackDepartures', () => {
  it('links a resolving creature spell to the permanent, which keeps the card id and not the stack id', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true })
    const prev = makeGameView({ players: [me], stack: { [MYSTIC_SPELL]: mystic(MYSTIC_SPELL) } })
    const next = makeGameView({ players: [{ ...me, battlefield: { [MYSTIC_CARD]: makePermanent({ ...mystic(MYSTIC_CARD) }) } }], stack: {} })
    expect(stackDepartures(prev, next).get(MYSTIC_SPELL)).toEqual({ cardId: MYSTIC_CARD, zone: 'battlefield', playerId: ME })
  })

  it('links a resolved instant to the card it left in the graveyard', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true })
    const prev = makeGameView({ players: [me], stack: { [BOLT_SPELL]: bolt(BOLT_SPELL) } })
    const next = makeGameView({ players: [{ ...me, graveyard: { [BOLT_CARD]: bolt(BOLT_CARD) } }], stack: {} })
    expect(stackDepartures(prev, next).get(BOLT_SPELL)).toEqual({ cardId: BOLT_CARD, zone: 'graveyard', playerId: ME })
  })

  it('never takes a card that was already in that zone', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true, graveyard: { [BOLT_CARD]: bolt(BOLT_CARD) } })
    const prev = makeGameView({ players: [me], stack: { [BOLT_SPELL]: bolt(BOLT_SPELL) } })
    const next = makeGameView({ players: [me], stack: {} })
    expect(stackDepartures(prev, next).has(BOLT_SPELL)).toBe(false)
  })

  it('still matches a view that keys the permanent by the stack id', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true })
    const prev = makeGameView({ players: [me], stack: { s: mystic('s') } })
    const next = makeGameView({ players: [{ ...me, battlefield: { s: makePermanent({ ...mystic('s') }), other: makePermanent({ ...mystic('other') }) } }], stack: {} })
    expect(stackDepartures(prev, next).get('s')?.cardId).toBe('s')
  })

  it('pairs two same-name spells with two different cards', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true })
    const prev = makeGameView({ players: [me], stack: { s1: bolt('s1'), s2: bolt('s2') } })
    const next = makeGameView({ players: [{ ...me, graveyard: { c1: bolt('c1'), c2: bolt('c2') } }], stack: {} })
    const links = stackDepartures(prev, next)
    expect(new Set([links.get('s1')?.cardId, links.get('s2')?.cardId])).toEqual(new Set(['c1', 'c2']))
  })
})

describe('castCard', () => {
  it('finds the hand card a spell was cast from, though the spell has an id of its own', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true })
    const prev = makeGameView({ players: [me], myHand: { [BOLT_CARD]: bolt(BOLT_CARD) } })
    const next = makeGameView({ players: [me], myHand: {}, stack: { [BOLT_SPELL]: bolt(BOLT_SPELL) } })
    expect(castCard(BOLT_SPELL, bolt(BOLT_SPELL), prev, next)).toEqual({ id: BOLT_CARD, zone: 'hand' })
  })

  it('finds a flashback card that left the graveyard', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true, graveyard: { [BOLT_CARD]: bolt(BOLT_CARD) } })
    const prev = makeGameView({ players: [me] })
    const next = makeGameView({ players: [{ ...me, graveyard: {} }], stack: { [BOLT_SPELL]: bolt(BOLT_SPELL) } })
    expect(castCard(BOLT_SPELL, bolt(BOLT_SPELL), prev, next)).toEqual({ id: BOLT_CARD, zone: 'graveyard' })
  })

  it('a card still in the graveyard was not cast from it', () => {
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true, graveyard: { [BOLT_CARD]: bolt(BOLT_CARD) } })
    const prev = makeGameView({ players: [me] })
    const next = makeGameView({ players: [me], stack: { [BOLT_SPELL]: bolt(BOLT_SPELL) } })
    expect(castCard(BOLT_SPELL, bolt(BOLT_SPELL), prev, next)).toBeNull()
  })
})

describe('primeStackEntries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearCardPositionRegistry()
    document.body.innerHTML = ''
  })

  it('records the resolving spell where it is drawn on the stack, under the permanent id', () => {
    document.body.innerHTML = `<div class="stack-zone"><div class="card-slot" data-card-id="${MYSTIC_SPELL}"></div></div>`
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(900, 120, 100, 140))
    const me = makePlayer({ playerId: ME, name: 'A', controlled: true })
    const prev = makeGameView({ players: [me], stack: { [MYSTIC_SPELL]: mystic(MYSTIC_SPELL) } })
    const next = makeGameView({ players: [{ ...me, battlefield: { [MYSTIC_CARD]: makePermanent({ ...mystic(MYSTIC_CARD) }) } }], stack: {} })
    primeStackEntries(prev, next)
    expect(getPreviousCardPosition(MYSTIC_CARD)?.left).toBe(900)
    expect(getPreviousCardZone(MYSTIC_CARD)).toBe('stack-zone')
  })
})
