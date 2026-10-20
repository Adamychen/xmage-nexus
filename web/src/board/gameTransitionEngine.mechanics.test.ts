import { describe, expect, it } from 'vitest'
import { castFromPile, copiedSpellId, exileArrivals, flippedChanges, myHandReturns, opponentBounceIds, opponentHandReturns, playerCounterChanges, ptChangeLabel, ptChanges, turnedFaceUp, ultimatePlaneswalkerIds } from './gameTransitionEngine'
import { passedDesignations } from './designationFx'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

const bolt = (id: string, controllerId: string) => makeCard({ id, name: 'Lightning Bolt', cardTypes: ['Instant'], controllerId })

describe('copiedSpellId', () => {
  const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true, handCount: 3 })
  const opp = makePlayer({ playerId: 'opp', name: 'Bob', handCount: 4 })

  it('reads a new same-name spell as a copy of the one on the stack', () => {
    const prev = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me') } })
    const next = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me'), b: bolt('b', 'me') } })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBe('a')
  })

  it('a second copy of the same card cast from my hand is a cast', () => {
    const prev = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me') }, myHand: { b: bolt('b', 'me') } })
    const next = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me'), b: bolt('b', 'me') }, myHand: {} })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBeNull()
  })

  it('an opponent casting the same card from their hand is a cast', () => {
    const prev = makeGameView({ players: [me, opp], stack: { a: bolt('a', 'me') } })
    const next = makeGameView({ players: [me, { ...opp, handCount: 3 }], stack: { a: bolt('a', 'me'), b: bolt('b', 'opp') } })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBeNull()
  })

  it('needs an original of the same name', () => {
    const prev = makeGameView({ players: [me, opp], stack: {} })
    const next = makeGameView({ players: [me, opp], stack: { b: bolt('b', 'me') } })
    expect(copiedSpellId('b', next.stack.b, prev, next)).toBeNull()
  })
})

describe('ultimatePlaneswalkerIds', () => {
  const pw = (loyalty: string) => makePermanent({ name: 'Jace', cardTypes: ['Planeswalker'], loyalty })

  it('reads a loyalty drop of 6 or more as an ultimate', () => {
    const prevP = makePlayer({ playerId: 'p', name: 'A', battlefield: { j: pw('8') } })
    expect(ultimatePlaneswalkerIds(prevP, { ...prevP, battlefield: { j: pw('1') } }, {}, {})).toEqual(['j'])
    expect(ultimatePlaneswalkerIds(prevP, { ...prevP, battlefield: { j: pw('5') } }, {}, {})).toEqual([])
  })

  it('reads a planeswalker that died paying for its own new ability as an ultimate', () => {
    const prevP = makePlayer({ playerId: 'p', name: 'A', battlefield: { j: pw('7') } })
    const nextP = { ...prevP, battlefield: {} }
    const ability = makeCard({ id: 'ab', name: 'Ultimate', isAbility: true, sourceCard: makeCard({ id: 'j', name: 'Jace' }) })
    expect(ultimatePlaneswalkerIds(prevP, nextP, {}, { ab: ability })).toEqual(['j'])
    expect(ultimatePlaneswalkerIds(prevP, nextP, {}, {})).toEqual([])
  })
})

describe('passedDesignations', () => {
  const a = makePlayer({ playerId: 'a', name: 'A' })
  const b = makePlayer({ playerId: 'b', name: 'B' })

  it('names the old and the new holder', () => {
    const prev = makeGameView({ players: [{ ...a, monarch: true }, b] })
    const next = makeGameView({ players: [a, { ...b, monarch: true }] })
    expect(passedDesignations(prev, next)).toEqual([{ kind: 'monarch', from: 'a', to: 'b' }])
  })

  it('a designation nobody held comes from nowhere; one kept or lost does not move', () => {
    const none = makeGameView({ players: [a, b] })
    const held = makeGameView({ players: [{ ...a, initiative: true }, b] })
    expect(passedDesignations(none, held)).toEqual([{ kind: 'initiative', from: null, to: 'a' }])
    expect(passedDesignations(held, held)).toEqual([])
    expect(passedDesignations(held, none)).toEqual([])
  })
})

describe('ptChanges', () => {
  const bear = (power: string, toughness: string, extra: Record<string, unknown> = {}) => makePermanent({ name: 'Grizzly Bears', power, toughness, ...extra })
  const board = (perm: ReturnType<typeof bear>) => makePlayer({ playerId: 'p', name: 'A', battlefield: { b: perm } })

  it('reports a pump and a shrink of a creature that stays', () => {
    expect(ptChanges(board(bear('2', '2')), board(bear('5', '5')))).toEqual([{ id: 'b', power: 3, toughness: 3 }])
    expect(ptChanges(board(bear('4', '4')), board(bear('2', '2')))).toEqual([{ id: 'b', power: -2, toughness: -2 }])
  })

  it('keeps both signs of a mixed change', () => {
    const [change] = ptChanges(board(bear('2', '2')), board(bear('4', '1')))
    expect(change).toEqual({ id: 'b', power: 2, toughness: -1 })
    expect(ptChangeLabel(change)).toBe('+2/-1')
    expect(ptChangeLabel({ id: 'b', power: 3, toughness: 0 })).toBe('+3/+0')
  })

  it('ignores a change fully explained by +1/+1 or -1/-1 counters, and reports what is left', () => {
    const plus = (count: number) => [{ name: '+1/+1', count }]
    expect(ptChanges(board(bear('2', '2', { counters: plus(1) })), board(bear('3', '3', { counters: plus(2) })))).toEqual([])
    expect(ptChanges(board(bear('2', '2')), board(bear('1', '1', { counters: [{ name: '-1/-1', count: 1 }] })))).toEqual([])
    expect(ptChanges(board(bear('2', '2')), board(bear('6', '6', { counters: plus(1) })))).toEqual([{ id: 'b', power: 3, toughness: 3 }])
  })

  it('ignores entering, transforming, turning face up and non-creatures', () => {
    const empty = makePlayer({ playerId: 'p', name: 'A' })
    expect(ptChanges(empty, board(bear('2', '2')))).toEqual([])
    expect(ptChanges(board(bear('1', '1')), board(bear('3', '2', { transformed: true })))).toEqual([])
    expect(ptChanges(board(bear('2', '2', { faceDown: true })), board(bear('5', '5')))).toEqual([])
    expect(ptChanges(board(bear('1', '1')), board(bear('3', '2', { name: 'Insectile Aberration' })))).toEqual([])
    expect(ptChanges(board(bear('0', '0', { cardTypes: ['Land'] })), board(bear('3', '3')))).toEqual([])
    expect(ptChanges(board(bear('*', '*')), board(bear('3', '3')))).toEqual([])
  })
})

describe('hand returns', () => {
  const card = (id: string) => makeCard({ id, name: 'Eternal Witness' })

  it('reads a new card of my hand that was in my graveyard or exile as returned from that pile', () => {
    const prevMe = makePlayer({ playerId: 'me', name: 'A', controlled: true, graveyard: { g: card('g') }, exile: { x: card('x') } })
    const prev = makeGameView({ players: [prevMe], myHand: {} })
    const next = makeGameView({ players: [{ ...prevMe, graveyard: {}, exile: {} }], myHand: { g: card('g'), x: card('x'), d: card('d') } })
    expect([...myHandReturns(prev, next)]).toEqual([['g', 'graveyard'], ['x', 'exile']])
    expect(myHandReturns(null, next).size).toBe(0)
  })

  it('reads an opponent graveyard card that went nowhere visible while their hand grew as returned', () => {
    const prevOpp = makePlayer({ playerId: 'o', name: 'B', handCount: 2, graveyard: { g: card('g'), h: card('h') } })
    const nextOpp = { ...prevOpp, handCount: 3, graveyard: { h: card('h') } }
    expect(opponentHandReturns(prevOpp, nextOpp, makeGameView({ players: [nextOpp] })).map((r) => [r.id, r.pile])).toEqual([['g', 'graveyard']])
  })

  it('an opponent graveyard card that moved to a visible zone, or with no hand growth, is not a return', () => {
    const prevOpp = makePlayer({ playerId: 'o', name: 'B', handCount: 2, graveyard: { g: card('g') } })
    const cast = { ...prevOpp, handCount: 3, graveyard: {} }
    expect(opponentHandReturns(prevOpp, cast, makeGameView({ players: [cast], stack: { g: card('g') } }))).toEqual([])
    const noGrowth = { ...prevOpp, graveyard: {} }
    expect(opponentHandReturns(prevOpp, noGrowth, makeGameView({ players: [noGrowth] }))).toEqual([])
  })
})

describe('exileArrivals', () => {
  const card = (id: string) => makeCard({ id, name: 'Card ' + id })

  it('names the zone each new exile card left: graveyard, my hand or the library', () => {
    const prevMe = makePlayer({ playerId: 'me', name: 'A', controlled: true, graveyard: { g: card('g') } })
    const nextMe = { ...prevMe, graveyard: {}, exile: { g: card('g'), h: card('h'), l: card('l') } }
    const prev = makeGameView({ players: [prevMe], myHand: { h: card('h') } })
    expect(exileArrivals(prevMe, nextMe, prev)).toEqual([
      { id: 'g', origin: 'graveyard' },
      { id: 'h', origin: 'hand' },
      { id: 'l', origin: 'library' },
    ])
  })

  it('an opponent card is from their hand when the hand shrank', () => {
    const prevOpp = makePlayer({ playerId: 'o', name: 'B', handCount: 3 })
    const nextOpp = { ...prevOpp, handCount: 2, exile: { f: card('f') } }
    expect(exileArrivals(prevOpp, nextOpp, makeGameView({ players: [prevOpp] }))).toEqual([{ id: 'f', origin: 'hand' }])
  })

  it('skips cards that were on the battlefield or the stack (those already fly)', () => {
    const prevMe = makePlayer({ playerId: 'me', name: 'A', battlefield: { p: makePermanent({ id: 'p', name: 'Bear' }) } })
    const nextMe = { ...prevMe, battlefield: {}, exile: { p: card('p'), s: card('s') } }
    expect(exileArrivals(prevMe, nextMe, makeGameView({ players: [prevMe], stack: { s: card('s') } }))).toEqual([])
  })
})

describe('castFromPile', () => {
  const me = makePlayer({ playerId: 'me', name: 'A', graveyard: { fb: makeCard({ id: 'fb', name: 'Faithless Looting' }) }, exile: { ad: makeCard({ id: 'ad', name: 'Bonecrusher Giant' }) } })
  const prev = makeGameView({ players: [me] })

  it('finds the graveyard or exile the spell (or its source card) left', () => {
    expect(castFromPile(makeCard({ id: 'fb', name: 'Faithless Looting', controllerId: 'me' }), 'fb', prev)).toBe('graveyard')
    expect(castFromPile(makeCard({ id: 's1', name: 'Stomp', controllerId: 'me', sourceCard: makeCard({ id: 'ad', name: 'Bonecrusher Giant' }) }), 's1', prev)).toBe('exile')
  })

  it('a spell from the hand comes from no pile', () => {
    expect(castFromPile(makeCard({ id: 'h', name: 'Opt', controllerId: 'me' }), 'h', prev)).toBeNull()
  })
})

describe('turnedFaceUp', () => {
  const faceDown = (flags: Record<string, boolean>) => makePermanent({ name: 'Morph: Den Protector', faceDown: true, power: '2', toughness: '2', ...flags })
  const board = (perm: ReturnType<typeof makePermanent>) => makePlayer({ playerId: 'p', name: 'A', battlefield: { m: perm } })

  it('names the face-down kind of a permanent that stays and turns face up', () => {
    const face = makePermanent({ name: 'Den Protector', power: '2', toughness: '1' })
    expect(turnedFaceUp(board(faceDown({ morphed: true })), board(face))).toEqual([{ id: 'm', kind: 'morph' }])
    expect(turnedFaceUp(board(faceDown({ manifested: true })), board(face))).toEqual([{ id: 'm', kind: 'manifest' }])
    expect(turnedFaceUp(board(faceDown({ disguised: true })), board(face))).toEqual([{ id: 'm', kind: 'disguise' }])
    expect(turnedFaceUp(board(faceDown({ cloaked: true })), board(face))).toEqual([{ id: 'm', kind: 'cloak' }])
    expect(turnedFaceUp(board(faceDown({})), board(face))).toEqual([{ id: 'm', kind: 'face-down' }])
  })

  it('a card still face down, one turned face down, or one that left is not turned face up', () => {
    const face = makePermanent({ name: 'Den Protector' })
    expect(turnedFaceUp(board(faceDown({ morphed: true })), board(faceDown({ morphed: true })))).toEqual([])
    expect(turnedFaceUp(board(face), board(faceDown({ manifested: true })))).toEqual([])
    expect(turnedFaceUp(board(faceDown({ morphed: true })), makePlayer({ playerId: 'p', name: 'A' }))).toEqual([])
  })
})

describe('playerCounterChanges', () => {
  const withCounters = (counters: Array<{ name: string; count: number }>) => makePlayer({ playerId: 'p', name: 'A', counters })

  it('reports each counter whose count moved, a missing one counting as 0', () => {
    expect(playerCounterChanges(withCounters([]), withCounters([{ name: 'poison', count: 1 }]))).toEqual([{ name: 'poison', from: 0, to: 1 }])
    expect(playerCounterChanges(withCounters([{ name: 'energy', count: 4 }]), withCounters([{ name: 'energy', count: 1 }]))).toEqual([{ name: 'energy', from: 4, to: 1 }])
    expect(playerCounterChanges(withCounters([{ name: 'rad', count: 2 }]), withCounters([]))).toEqual([{ name: 'rad', from: 2, to: 0 }])
  })

  it('leaves unchanged counters out', () => {
    const same = withCounters([{ name: 'experience', count: 2 }, { name: 'poison', count: 3 }])
    expect(playerCounterChanges(same, withCounters([{ name: 'poison', count: 3 }, { name: 'experience', count: 2 }]))).toEqual([])
  })
})

describe('opponentBounceIds and control changes', () => {
  it('a permanent stolen from an opponent whose hand grew is not read as bounced', () => {
    const elf = makePermanent({ id: 'e', name: 'Elvish Mystic' })
    const prevOpp = makePlayer({ playerId: 'o', name: 'B', handCount: 2, battlefield: { e: elf } })
    const nextOpp = { ...prevOpp, handCount: 3, battlefield: {} }
    const me = makePlayer({ playerId: 'me', name: 'A', controlled: true, battlefield: { e: elf } })
    expect(opponentBounceIds(prevOpp, nextOpp, makeGameView({ players: [me, nextOpp] }))).toEqual([])
    expect(opponentBounceIds(prevOpp, nextOpp, makeGameView({ players: [{ ...me, battlefield: {} }, nextOpp] }))).toEqual(['e'])
  })
})

describe('flippedChanges', () => {
  it('reads a permanent whose flipped flag toggled, either way', () => {
    const bushi = (flipped: boolean) => makePermanent({ id: 'b', name: flipped ? 'Kenzo the Hardhearted' : 'Bushi Tenderfoot', flipped })
    const before = makePlayer({ playerId: 'me', name: 'A', battlefield: { b: bushi(false) } })
    const after = makePlayer({ playerId: 'me', name: 'A', battlefield: { b: bushi(true) } })
    expect(flippedChanges(before, after)).toEqual(['b'])
    expect(flippedChanges(after, before)).toEqual(['b'])
    expect(flippedChanges(after, after)).toEqual([])
  })
})
