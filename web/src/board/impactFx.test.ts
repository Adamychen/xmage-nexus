import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardManaColors, clearImpacts, getImpacts, particleVectors, slamSpell, spawnImpact, spellWeight } from './impactFx'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { clearFlights, getActiveFlights } from './flightManager'
import { clearCardPositionRegistry } from './cardPositionRegistry'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

const rect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

describe('cardManaColors', () => {
  it('reads the server colour flags in WUBRG order', () => {
    expect(cardManaColors({ color: { red: true, white: true } })).toEqual(['w', 'r'])
  })

  it('falls back to the mana cost symbols, including hybrids', () => {
    expect(cardManaColors({ color: null, manaCostLeftStr: ['{2}', '{G/U}', '{B}'] })).toEqual(['u', 'b', 'g'])
  })

  it('is empty for colourless cards', () => {
    expect(cardManaColors({ color: {}, manaCostLeftStr: ['{7}'] })).toEqual([])
    expect(cardManaColors(null)).toEqual([])
  })
})

describe('spellWeight', () => {
  it('keeps cheap non-mythic spells light', () => {
    expect(spellWeight(makeCard({ name: 'Lightning Bolt', manaValue: 1, rarity: 'UNCOMMON' }))).toBe(0)
  })

  it('marks five-drops and mythics as heavy', () => {
    expect(spellWeight(makeCard({ name: 'Wrath of God', manaValue: 5, rarity: 'RARE' }))).toBe(1)
    expect(spellWeight(makeCard({ name: 'Ragavan', manaValue: 1, rarity: 'MYTHIC' }))).toBe(1)
  })

  it('marks seven-drops and expensive mythics as epic', () => {
    expect(spellWeight(makeCard({ name: 'Emrakul', manaValue: 15, rarity: 'MYTHIC' }))).toBe(2)
    expect(spellWeight(makeCard({ name: 'Craterhoof', manaValue: 8, rarity: 'RARE' }))).toBe(2)
    expect(spellWeight(makeCard({ name: 'Elspeth', manaValue: 5, rarity: 'MYTHIC' }))).toBe(2)
  })

  it('never weighs abilities', () => {
    expect(spellWeight(makeCard({ name: 'Ability', manaValue: 9, isAbility: true, rarity: 'MYTHIC' }))).toBe(0)
  })
})

describe('particleVectors', () => {
  it('is deterministic per seed and spreads around the origin', () => {
    const a = particleVectors(42, 8, 100)
    expect(particleVectors(42, 8, 100)).toEqual(a)
    expect(a).toHaveLength(8)
    expect(a.some((p) => p.dx > 0)).toBe(true)
    expect(a.some((p) => p.dx < 0)).toBe(true)
    expect(a.every((p) => Math.hypot(p.dx, p.dy) <= 120)).toBe(true)
  })
})

describe('impact store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearImpacts()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.innerHTML = '<head></head><body></body>'
  })

  it('spawns and expires an impact', () => {
    const fx = spawnImpact('sparks', rect(10, 20))
    expect(fx).not.toBeNull()
    expect(getImpacts()).toHaveLength(1)
    expect(getImpacts()[0]).toMatchObject({ kind: 'sparks', x: 50, y: 76 })
    vi.advanceTimersByTime(2000)
    expect(getImpacts()).toHaveLength(0)
  })

  it('ignores positioned impacts without a usable rect', () => {
    expect(spawnImpact('destroy', null)).toBeNull()
    expect(spawnImpact('destroy', rect(0, 0, 0, 0))).toBeNull()
  })

  it('slams a heavy spell after the landing delay and quakes the board', () => {
    document.body.innerHTML = '<div class="board-shell"></div>'
    const weight = slamSpell(makeCard({ name: 'Ulamog', manaValue: 10, color: {} }))
    expect(weight).toBe(2)
    expect(getImpacts()).toHaveLength(0)
    vi.advanceTimersByTime(400)
    expect(getImpacts()).toEqual([expect.objectContaining({ kind: 'slam', weight: 2 })])
    expect(document.querySelector('.board-shell')?.classList.contains('fx-quake-2')).toBe(true)
  })

  it('does not slam light spells', () => {
    expect(slamSpell(makeCard({ name: 'Opt', manaValue: 1 }))).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(getImpacts()).toHaveLength(0)
  })
})

describe('transition engine impacts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    clearImpacts()
    clearFlights()
    clearCardPositionRegistry()
    document.body.innerHTML = `
      <div class="player-zone" data-player-id="p-bob" data-player-name="Bob">
        <div class="creatures-band"><div data-card-id="c-bear"></div><div data-card-id="t-new"></div></div>
        <div class="graveyard-stack"></div>
        <div class="exile-stack"></div>
      </div>`
    const spy = (sel: string, r: DOMRect) => {
      const el = document.querySelector(sel)
      if (el) vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(r)
    }
    spy('[data-card-id="c-bear"]', rect(400, 300))
    spy('[data-card-id="t-new"]', rect(500, 300))
    spy('.creatures-band', rect(300, 300, 600, 112))
    spy('.graveyard-stack', rect(100, 100))
    spy('.exile-stack', rect(100, 250))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const bear = makePermanent({ id: 'c-bear', name: 'Grizzly Bears', cardTypes: ['CREATURE'] })

  it('burns a creature that dies and flies it to the graveyard with the destroy variant', () => {
    const prev = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: { 'c-bear': bear } })] })
    const next = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: {}, graveyard: { 'c-bear': bear } })] })
    detectAndAnimateTransitions(prev, next)
    expect(getImpacts().map((f) => f.kind)).toContain('destroy')
    vi.advanceTimersByTime(40)
    expect(getActiveFlights().find((f) => f.cardId === 'c-bear')?.variant).toBe('destroy')
  })

  it('sacrificed lands fly to the graveyard without the burn effect', () => {
    const land = makePermanent({ id: 'c-bear', name: 'Polluted Delta', cardTypes: ['LAND'] })
    const prev = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: { 'c-bear': land } })] })
    const next = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: {}, graveyard: { 'c-bear': land } })] })
    detectAndAnimateTransitions(prev, next)
    expect(getImpacts()).toHaveLength(0)
    vi.advanceTimersByTime(40)
    expect(getActiveFlights().find((f) => f.cardId === 'c-bear')?.variant).toBeUndefined()
  })

  it('beams an exiled permanent away with the exile variant', () => {
    const prev = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: { 'c-bear': bear } })] })
    const next = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: {}, exile: { 'c-bear': bear } })] })
    detectAndAnimateTransitions(prev, next)
    expect(getImpacts().map((f) => f.kind)).toContain('exile')
    vi.advanceTimersByTime(40)
    expect(getActiveFlights().find((f) => f.cardId === 'c-bear')?.variant).toBe('exile')
  })

  it('puffs a token that stops existing', () => {
    const token = makePermanent({ id: 'c-bear', name: 'Soldier', isToken: true })
    const prev = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: { 'c-bear': token } })] })
    const next = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: {} })] })
    detectAndAnimateTransitions(prev, next)
    expect(getImpacts().map((f) => f.kind)).toEqual(['token-fade'])
  })

  it('pops a token that enters the battlefield', () => {
    const token = makePermanent({ id: 't-new', name: 'Treasure', isToken: true })
    const prev = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: {} })] })
    const next = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: { 't-new': token } })] })
    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(40)
    expect(getImpacts().map((f) => f.kind)).toContain('token-pop')
  })

  it('throws sparks when a creature takes damage', () => {
    const prev = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: { 'c-bear': bear } })] })
    const hurt = { ...bear, damage: 2 }
    const next = makeGameView({ players: [makePlayer({ playerId: 'p-bob', name: 'Bob', battlefield: { 'c-bear': hurt } })] })
    detectAndAnimateTransitions(prev, next)
    expect(getImpacts().map((f) => f.kind)).toContain('sparks')
  })
})
