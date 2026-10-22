import { describe, expect, it } from 'vitest'
import {
  computeNextManaAction,
  nextSmartManaAction,
  opponentOpenManaCount,
  ownManaSources,
  parseRemainingManaCost,
  reservedColorsForInstants,
} from './smartManaPayment'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import attackCostFrame from '../../fixtures/recorded/attack-cost.json'
import type { GameView, PermanentView } from '../net/types'
import type { PoolKey } from './manaPayment'

const EMPTY_POOL: Record<PoolKey, number> = { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }

const land = (name: string, rule: string, extra: Partial<PermanentView> = {}) =>
  makePermanent({ name, cardTypes: ['LAND'], rules: [rule], ...extra })

const forest = (extra: Partial<PermanentView> = {}) => land('Forest', '{T}: Add {G}.', extra)
const island = (extra: Partial<PermanentView> = {}) => land('Island', '{T}: Add {U}.', extra)

function me(battlefield: Record<string, PermanentView>) {
  return makePlayer({ playerId: 'p1', name: 'Me', controlled: true, battlefield })
}

function sourcesOf(battlefield: Record<string, PermanentView>, pool: Partial<Record<PoolKey, number>> = {}) {
  return ownManaSources(me(battlefield), { ...EMPTY_POOL, ...pool })
}

describe('parseRemainingManaCost', () => {
  it('MNA-7: reads generic and colored pips from the plain prompt message', () => {
    expect(parseRemainingManaCost('Pay {2}{R}{R} Krenko [304]')).toEqual({
      generic: 2,
      pips: [{ options: ['R'] }, { options: ['R'] }],
      unresolved: [],
    })
  })

  it('MNA-7: reads hybrid, phyrexian and colorless pips', () => {
    const cost = parseRemainingManaCost('Pay {W/B}{U/P}{C}')
    expect(cost.pips).toEqual([{ options: ['W', 'B'] }, { options: ['U'] }, { options: ['C'] }])
    expect(cost.unresolved).toEqual([])
  })

  it('MNA-7: flags tokens it cannot model instead of guessing', () => {
    expect(parseRemainingManaCost('Pay {X}{R}').unresolved).toEqual(['X'])
    expect(parseRemainingManaCost('Pay {S}').unresolved).toEqual(['S'])
    expect(parseRemainingManaCost('Pay {2/W}').unresolved).toEqual(['2/W'])
  })

  it('MNA-7: returns an empty cost when the message has no symbols', () => {
    expect(parseRemainingManaCost('Pay mana')).toEqual({ generic: 0, pips: [], unresolved: [] })
  })
})

describe('ownManaSources', () => {
  it('MNA-8: lists untapped permanents with a plain tap-for-mana ability', () => {
    const sources = sourcesOf({ f1: forest(), f2: forest({ tapped: true }), i1: island() })
    expect(sources.map((s) => s.key).sort()).toEqual(['tap:f1', 'tap:i1'])
  })

  it('MNA-8: skips summoning-sick creatures and phased-out permanents', () => {
    const elf = makePermanent({ name: 'Llanowar Elves', cardTypes: ['CREATURE'], rules: ['{T}: Add {G}.'] })
    const sources = sourcesOf({
      sick: { ...elf, summoningSickness: true },
      ready: elf,
      away: forest({ phasedIn: false }),
    })
    expect(sources.map((s) => s.key)).toEqual(['tap:ready'])
  })

  it('MNA-8: parses duals and any-color sources', () => {
    const sources = sourcesOf({
      dual: land('Tundra', '{T}: Add {W} or {U}.'),
      tri: land('Tri', '{T}: Add {B}, {R}, or {G}.'),
      any: land('Command Tower', '{T}: Add one mana of any color.'),
    })
    expect(sources.find((s) => s.id === 'dual')?.produces).toEqual(['W', 'U'])
    expect(sources.find((s) => s.id === 'tri')?.produces).toEqual(['B', 'R', 'G'])
    expect(sources.find((s) => s.id === 'any')?.produces).toEqual(['W', 'U', 'B', 'R', 'G'])
  })

  it('MNA-8: leaves out abilities with extra costs, restrictions or multiple mana', () => {
    const sources = sourcesOf({
      treasure: makePermanent({ name: 'Treasure', cardTypes: ['ARTIFACT'], rules: ['{T}, Sacrifice this artifact: Add one mana of any color.'] }),
      cavern: land('Cavern', '{T}: Add one mana of any color. Spend this mana only to cast a creature spell of the chosen type.'),
      double: land('Double', '{T}: Add {G}{G}.'),
      plain: forest(),
    })
    expect(sources.map((s) => s.id)).toEqual(['plain'])
  })

  it('MNA-9: flags pain lands whose mana rules cost life or damage', () => {
    const sources = sourcesOf({
      wastes: land('Llanowar Wastes', '{T}: Add {C}.'),
    })
    expect(sources.find((s) => s.id === 'wastes')?.painful).toBe(false)
    const painful = sourcesOf({
      wastes: makePermanent({
        name: 'Llanowar Wastes',
        cardTypes: ['LAND'],
        rules: ['{T}: Add {C}.', '{T}: Add {B}. Llanowar Wastes deals 1 damage to you.', '{T}: Add {G}. Llanowar Wastes deals 1 damage to you.'],
      }),
      city: makePermanent({
        name: 'City of Brass',
        cardTypes: ['LAND'],
        rules: ['{T}: Add one mana of any color.', 'Whenever City of Brass becomes tapped, it deals 1 damage to you.'],
      }),
      shock: makePermanent({
        name: 'Overgrown Tomb',
        cardTypes: ['LAND'],
        rules: ['{T}: Add {B} or {G}.', 'As Overgrown Tomb enters the battlefield, you may pay 2 life. If you don\'t, it enters tapped.'],
      }),
    })
    expect(painful.find((s) => s.id === 'wastes')?.painful).toBe(true)
    expect(painful.find((s) => s.id === 'city')?.painful).toBe(true)
    expect(painful.find((s) => s.id === 'shock')?.painful).toBe(false)
  })

  it('MNA-8: adds one source per floating mana in the pool', () => {
    const sources = sourcesOf({}, { red: 2, colorless: 1 })
    expect(sources.map((s) => [s.kind, s.poolColor])).toEqual([
      ['pool', 'red'],
      ['pool', 'red'],
      ['pool', 'colorless'],
    ])
  })

  it('MNA-8: real frame: finds untapped Forests even though canPlayObjects arrives empty', () => {
    const game = (attackCostFrame as unknown as { gameView: GameView }).gameView
    expect(Object.keys(game.canPlayObjects?.objects ?? {})).toEqual([])
    const player = game.players!.find((p) => p.controlled)!
    const untapped = Object.values(player.battlefield).filter((p) => p.tapped !== true && (p.rules ?? []).some((r) => r.startsWith('{T}: Add')))
    expect(untapped.length).toBeGreaterThan(0)
    expect(ownManaSources(player, EMPTY_POOL)).toHaveLength(untapped.length)
  })
})

describe('computeNextManaAction', () => {
  const cost = (msg: string) => parseRemainingManaCost(msg)

  it('MNA-8: taps a matching source for a colored pip', () => {
    const sources = sourcesOf({ f1: forest(), f2: forest() })
    const action = computeNextManaAction(cost('Pay {G}{G}'), sources)
    expect(action?.kind).toBe('tapPermanent')
  })

  it('MNA-8: keeps the any-color source for later and uses the Forest for the pip', () => {
    const sources = sourcesOf({ dork: land('Birds', '{T}: Add one mana of any color.'), f1: forest() })
    expect(computeNextManaAction(cost('Pay {1}{G}'), sources)).toEqual({ kind: 'tapPermanent', id: 'f1' })
  })

  it('MNA-8: spends colorless sources on generic before colored ones', () => {
    const sources = sourcesOf({ a: forest(), b: island(), z: land('Wastes', '{T}: Add {C}.') })
    expect(computeNextManaAction(cost('Pay {2}'), sources)).toEqual({ kind: 'tapPermanent', id: 'z' })
  })

  it('MNA-8: pays from the floating pool first', () => {
    const sources = sourcesOf({ m1: land('Mountain', '{T}: Add {R}.') }, { red: 1 })
    expect(computeNextManaAction(cost('Pay {R}{1}'), sources)).toEqual({ kind: 'payPool', color: 'red' })
  })

  it('MNA-8: satisfies a hybrid pip with either color', () => {
    const sources = sourcesOf({ s1: land('Swamp', '{T}: Add {B}.') })
    expect(computeNextManaAction(cost('Pay {W/B}'), sources)).toEqual({ kind: 'tapPermanent', id: 's1' })
  })

  it('MNA-8: only lets colorless sources pay a {C} pip', () => {
    expect(computeNextManaAction(cost('Pay {C}'), sourcesOf({ f1: forest() }))).toBeNull()
    expect(computeNextManaAction(cost('Pay {C}'), sourcesOf({ f1: forest(), w: land('Wastes', '{T}: Add {C}.') }))).toEqual({
      kind: 'tapPermanent',
      id: 'w',
    })
  })

  it('MNA-7: returns null when the cost cannot be paid', () => {
    expect(computeNextManaAction(cost('Pay {R}'), sourcesOf({ f1: forest() }))).toBeNull()
    expect(computeNextManaAction(cost('Pay {3}'), sourcesOf({ f1: forest(), f2: forest() }))).toBeNull()
  })

  it('MNA-9: never spends a pain land on generic while a painless source is open', () => {
    const wastes = makePermanent({
      name: 'Llanowar Wastes',
      cardTypes: ['LAND'],
      rules: ['{T}: Add {C}.', '{T}: Add {B}. Llanowar Wastes deals 1 damage to you.', '{T}: Add {G}. Llanowar Wastes deals 1 damage to you.'],
    })
    expect(computeNextManaAction(cost('Pay {2}'), sourcesOf({ f1: forest(), w: wastes }))).toEqual({
      kind: 'tapPermanent',
      id: 'f1',
    })
  })

  it('MNA-9: still taps the pain land for generic when it is the only source left', () => {
    const wastes = makePermanent({
      name: 'Llanowar Wastes',
      cardTypes: ['LAND'],
      rules: ['{T}: Add {C}.', '{T}: Add {B}. Llanowar Wastes deals 1 damage to you.', '{T}: Add {G}. Llanowar Wastes deals 1 damage to you.'],
    })
    expect(computeNextManaAction(cost('Pay {1}'), sourcesOf({ w: wastes }))).toEqual({
      kind: 'tapPermanent',
      id: 'w',
    })
  })

  it('MNA-7: bails on unresolved tokens and empty costs', () => {
    expect(computeNextManaAction(cost('Pay {X}'), sourcesOf({ f1: forest() }))).toBeNull()
    expect(computeNextManaAction(cost('Pay nothing'), sourcesOf({ f1: forest() }))).toBeNull()
  })

  it('MNA-8: reassigns sources when a greedy pick would strand a later pip', () => {
    const sources = sourcesOf({
      a: land('Tundra', '{T}: Add {W} or {U}.'),
      b: land('Plains', '{T}: Add {W}.'),
    })
    const action = computeNextManaAction(cost('Pay {U}{W}'), sources)
    expect(action).not.toBeNull()
  })

  it('MNA-8: keeps the last source of a color an instant in hand needs', () => {
    const sources = sourcesOf({ a: island(), b: forest() })
    expect(computeNextManaAction(cost('Pay {1}'), sources)).toEqual({ kind: 'tapPermanent', id: 'a' })
    expect(computeNextManaAction(cost('Pay {1}'), sources, new Set(['U']))).toEqual({ kind: 'tapPermanent', id: 'b' })
  })

  it('MNA-8: never lets the reserve change feasibility', () => {
    const sources = sourcesOf({ a: island() })
    expect(computeNextManaAction(cost('Pay {U}'), sources, new Set(['U']), 6)).toEqual({ kind: 'tapPermanent', id: 'a' })
  })
})

describe('public-information signals', () => {
  it('MNA-8: reserves the colors of instant and flash cards in the own hand', () => {
    const hand = {
      h1: makeCard({ name: 'Counterspell', cardTypes: ['INSTANT'], manaCostLeftStr: ['{U}', '{U}'] }),
      h2: makeCard({ name: 'Shock Sorcery', cardTypes: ['SORCERY'], manaCostLeftStr: ['{R}'] }),
      h3: makeCard({ name: 'Ambush Viper', cardTypes: ['CREATURE'], rules: ['Flash'], manaCostLeftStr: ['{1}', '{G}'] }),
    }
    expect([...reservedColorsForInstants(hand)].sort()).toEqual(['G', 'U'])
  })

  it('MNA-8: counts only untapped mana producers on opponent battlefields', () => {
    const game = makeGameView({
      players: [
        me({ mine: forest() }),
        makePlayer({
          playerId: 'p2',
          name: 'Opp',
          battlefield: { o1: island(), o2: island({ tapped: true }), o3: makePermanent({ name: 'Bear', rules: [] }) },
        }),
      ],
    })
    expect(opponentOpenManaCount(game)).toBe(1)
  })

  it('MNA-8: real frame: plans a tap for the attack tax although canPlayObjects is empty', () => {
    const game = (attackCostFrame as unknown as { gameView: GameView }).gameView
    const player = game.players!.find((p) => p.controlled)!
    const action = nextSmartManaAction(game, 'Pay {2} Propaganda [4f7]', EMPTY_POOL)
    expect(action?.kind).toBe('tapPermanent')
    const id = (action as { id: string }).id
    expect(player.battlefield[id]?.tapped).not.toBe(true)
  })
})
