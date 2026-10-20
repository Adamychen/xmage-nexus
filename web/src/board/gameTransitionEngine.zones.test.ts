import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { auraAttachments, detectAndAnimateTransitions, libraryTucks, mutateMerges } from './gameTransitionEngine'
import { clearFlights, getActiveFlights } from './flightManager'
import { clearCardPositionRegistry, recordCardPosition } from './cardPositionRegistry'
import { clearImpacts, getImpacts } from './impactFx'
import { clearStackHold } from './stackHold'
import { clearCommandReturns } from './commandFx'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView, PermanentView, PlayerView } from '../net/types'
import recordedMutate from '../../fixtures/recorded/mutate.json'
import recordedAura from '../../fixtures/recorded/aura.json'

const mockRect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

const seat = (game: GameView, i: number) => (game.players ?? [])[i]

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

const bear = makePermanent({ id: 'bear', name: 'Grizzly Bears' })
const alice = (partial: Partial<PlayerView> = {}) => makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, libraryCount: 40, ...partial })
const bob = (partial: Partial<PlayerView> = {}) => makePlayer({ playerId: 'p-bob', name: 'Bob', libraryCount: 40, handCount: 5, ...partial })

describe('libraryTucks', () => {
  it('reads a permanent that vanished while its controller\'s library grew (Chaos Warp)', () => {
    const prev = makeGameView({ players: [alice({ battlefield: { bear } })] })
    const next = makeGameView({ players: [alice({ libraryCount: 41 })] })
    expect(libraryTucks(seat(prev, 0), seat(next, 0), prev, next)).toEqual({ permanents: ['bear'], hand: [], hidden: 0 })
  })

  it('reads my hand cards put back, at most as many as the library grew (Brainstorm)', () => {
    const hand = { a: makeCard({ id: 'a', name: 'A' }), b: makeCard({ id: 'b', name: 'B' }), c: makeCard({ id: 'c', name: 'C' }) }
    const prev = makeGameView({ players: [alice({ handCount: 3 })], myHand: hand })
    const next = makeGameView({ players: [alice({ handCount: 1, libraryCount: 42 })], myHand: { c: hand.c } })
    expect(libraryTucks(seat(prev, 0), seat(next, 0), prev, next).hand).toEqual(['a', 'b'])
    const oneRoom = makeGameView({ players: [alice({ handCount: 1, libraryCount: 41 })], myHand: { c: hand.c } })
    expect(libraryTucks(seat(prev, 0), seat(oneRoom, 0), prev, oneRoom).hand).toEqual(['a'])
  })

  it('reads an opponent\'s hand shrinking into their library only when nothing of theirs became visible', () => {
    const prev = makeGameView({ players: [alice(), bob()] })
    const next = makeGameView({ players: [alice(), bob({ handCount: 3, libraryCount: 42 })] })
    expect(libraryTucks(seat(prev, 1), seat(next, 1), prev, next).hidden).toBe(2)
    const discarded = makeGameView({ players: [alice(), bob({ handCount: 3, libraryCount: 42, graveyard: { d: makeCard({ id: 'd', name: 'Discarded' }) } })] })
    expect(libraryTucks(seat(prev, 1), seat(discarded, 1), prev, discarded).hidden).toBe(0)
    const cast = makeGameView({ players: [alice(), bob({ handCount: 3, libraryCount: 42 })], stack: { s: makeCard({ id: 's', name: 'Bolt', controllerId: 'p-bob' }) } })
    expect(libraryTucks(seat(prev, 1), seat(cast, 1), prev, cast).hidden).toBe(0)
  })

  it('never reads the mulligan, a draw, a death or a token', () => {
    const hand = { a: makeCard({ id: 'a', name: 'A' }) }
    const prev = makeGameView({ players: [alice({ battlefield: { bear, tok: makePermanent({ id: 'tok', name: 'Goblin', isToken: true }) } })], myHand: hand })
    const mulligan = makeGameView({ phase: null, step: null, players: [alice({ libraryCount: 41 })], myHand: {} })
    expect(libraryTucks(seat(prev, 0), seat(mulligan, 0), prev, mulligan)).toEqual({ permanents: [], hand: [], hidden: 0 })
    const died = makeGameView({ players: [alice({ graveyard: { bear } })], myHand: hand })
    expect(libraryTucks(seat(prev, 0), seat(died, 0), prev, died).permanents).toEqual([])
    const tokenGone = makeGameView({ players: [alice({ battlefield: { bear }, libraryCount: 41 })], myHand: hand })
    expect(libraryTucks(seat(prev, 0), seat(tokenGone, 0), prev, tokenGone).permanents).toEqual([])
  })
})

describe('auraAttachments', () => {
  it('reads the recorded Rancor entering on its host, not one already there', () => {
    const frame = (recordedAura as unknown as { gameView: GameView }).gameView
    const meNext = (frame.players ?? []).find((p) => p.controlled)!
    const [rancorId, rancor] = Object.entries(meNext.battlefield ?? {}).find(([, p]) => p.attachedTo)!
    const battlefield = { ...meNext.battlefield }
    delete battlefield[rancorId]
    const mePrev = { ...meNext, battlefield }
    expect(auraAttachments(mePrev, meNext, frame)).toEqual([{ id: rancorId, hostId: rancor.attachedTo }])
    expect(auraAttachments(meNext, meNext, frame)).toEqual([])
    const hostGone = { ...battlefield, [rancorId]: rancor }
    delete hostGone[rancor.attachedTo!]
    const orphan = { ...meNext, battlefield: hostGone }
    expect(auraAttachments(mePrev, orphan, { ...frame, players: (frame.players ?? []).map((p) => (p.controlled ? orphan : p)) })).toEqual([])
  })
})

describe('mutateMerges', () => {
  const frame = (recordedMutate as unknown as { gameView: GameView }).gameView
  const meNext = (frame.players ?? []).find((p) => p.controlled)!
  const [hostId, host] = Object.entries(meNext.battlefield ?? {}).find(([, p]) => p.mutated)!
  const merged = Object.entries(host.mutateView?.cards ?? {}).find(([id]) => id !== hostId)!

  /** The recorded frame one view earlier: the host not yet mutated and the mutating card on the stack under a spell id of its own. */
  function beforeMerge(spellId: string): GameView {
    const unmutated = { ...host, mutated: false, mutateView: { name: host.name, id: hostId, cards: {} } } as PermanentView
    const spell = { ...merged[1], id: spellId, controllerId: meNext.playerId } as CardView
    return {
      ...frame,
      stack: { [spellId]: spell },
      players: (frame.players ?? []).map((p) => (p.controlled ? { ...p, battlefield: { ...p.battlefield, [hostId]: unmutated } } : p)),
    }
  }

  it('matches the departed mutating spell to the recorded host, even under a spell id of its own', () => {
    expect([...mutateMerges(beforeMerge('spell-ability-id'), frame)]).toEqual([['spell-ability-id', hostId]])
    expect([...mutateMerges(beforeMerge(merged[0]), frame)]).toEqual([[merged[0], hostId]])
  })

  it('ignores a spell that resolved elsewhere and a host that was already mutated with that card', () => {
    const otherSpell = { ...beforeMerge('s'), stack: { s: makeCard({ id: 's', name: 'Lightning Bolt' }) } }
    expect(mutateMerges(otherSpell, frame).size).toBe(0)
    expect(mutateMerges({ ...frame, stack: { s: { ...merged[1], id: 's' } } }, frame).size).toBe(0)
  })
})

describe('gameTransitionEngine: library, command zone, auras and mutate', () => {
  const LIBRARY = mockRect(100, 100, 60, 84)
  const GRAVEYARD = mockRect(200, 100, 60, 84)
  const HAND = mockRect(400, 600, 300, 112)
  const BEAR = mockRect(450, 400)
  const HOST = mockRect(600, 400)
  const AURA = mockRect(620, 380)
  const COMMAND = mockRect(40, 400, 70, 98)
  const STACK = mockRect(800, 300, 250, 400)
  const OPP_HAND = mockRect(400, 20, 300, 112)
  const OPP_LIBRARY = mockRect(100, 20, 60, 84)

  function stub(selector: string, rect: DOMRect): void {
    for (const el of document.querySelectorAll(selector)) vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    clearCardPositionRegistry()
    clearFlights()
    clearImpacts()
    clearStackHold()
    clearCommandReturns()
    document.body.innerHTML = `
      <div class="game-board">
        <div class="board-zone player-zone" data-player-id="p-alice" data-player-name="Alice">
          <div class="library-chip"></div>
          <div class="graveyard-chip"></div>
          <div class="command-zone"><div class="card-slot" data-card-id="cmd"></div></div>
          <div class="creatures-band">
            <div class="card-slot" data-card-id="host"></div>
            <div class="card-slot attachment-subcard" data-card-id="aura"></div>
          </div>
        </div>
        <div class="board-zone opponent-zone" data-player-id="p-bob" data-player-name="Bob">
          <div class="library-stack"></div>
          <div class="hand-zone"></div>
        </div>
        <div class="hand-bar"></div>
        <div class="stack-zone"><div data-card-id="mut-spell"><div class="stack-thumb"></div></div></div>
      </div>
    `
    stub('[data-player-id="p-alice"] .library-chip', LIBRARY)
    stub('[data-player-id="p-alice"] .graveyard-chip', GRAVEYARD)
    stub('.hand-bar', HAND)
    stub('[data-card-id="cmd"]', COMMAND)
    stub('.command-zone', COMMAND)
    stub('[data-card-id="host"]', HOST)
    stub('[data-card-id="aura"]', AURA)
    stub('.stack-zone', STACK)
    stub('[data-card-id="mut-spell"] .stack-thumb', mockRect(810, 320, 40, 56))
    stub('[data-player-id="p-bob"] .library-stack', OPP_LIBRARY)
    stub('[data-player-id="p-bob"] .hand-zone', OPP_HAND)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    clearCardPositionRegistry()
    document.body.innerHTML = ''
  })

  it('a tucked permanent sinks into a vortex and flies to its library, turning face down', () => {
    recordCardPosition('bear', BEAR, 'board-zone')
    const prev = makeGameView({ players: [alice({ battlefield: { bear } })] })
    detectAndAnimateTransitions(prev, makeGameView({ players: [alice({ libraryCount: 41 })] }))
    vi.advanceTimersByTime(60)
    const flight = getActiveFlights().find((f) => f.card.name === 'Grizzly Bears')
    expect(flight?.variant).toBe('tuck')
    expect(flight?.conceal).toBe(true)
    expect(center(flight!.toRect)).toEqual(center(LIBRARY))
    expect(getImpacts().some((fx) => fx.kind === 'tuck')).toBe(true)
  })

  it('my hand cards put back fly to my library and turn face down; an opponent\'s fly face down', () => {
    const hand = { a: makeCard({ id: 'a', name: 'Island' }), b: makeCard({ id: 'b', name: 'Forest' }) }
    recordCardPosition('a', mockRect(500, 620), 'hand-zone')
    const prev = makeGameView({ players: [alice({ handCount: 2 }), bob()], myHand: hand })
    const next = makeGameView({ players: [alice({ handCount: 1, libraryCount: 41 }), bob({ handCount: 3, libraryCount: 42 })], myHand: { b: hand.b } })
    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(300)
    const mine = getActiveFlights().find((f) => f.card.name === 'Island')
    expect(mine?.conceal).toBe(true)
    expect(center(mine!.toRect)).toEqual(center(LIBRARY))
    const hidden = getActiveFlights().filter((f) => f.cardId.startsWith('tuck-p-bob'))
    expect(hidden).toHaveLength(2)
    expect(hidden.every((f) => f.card.faceDown === true && !f.conceal)).toBe(true)
    expect(center(hidden[0].toRect)).toEqual(center(OPP_LIBRARY))
  })

  it('a commander going back to the command zone flies there with the crown\'s light', () => {
    const commander = makeCard({ id: 'cmd', name: 'Krenko, Mob Boss', cardTypes: ['CREATURE'], superTypes: ['LEGENDARY'], mageObjectType: 'COMMANDER' })
    const prev = makeGameView({ players: [alice({ graveyard: { cmd: commander } })] })
    const next = makeGameView({ players: [alice({ commandList: [commander] as PlayerView['commandList'] })] })
    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(60)
    const flight = getActiveFlights().find((f) => f.cardId === 'cmd')
    expect(flight?.variant).toBe('command')
    expect(center(flight!.fromRect)).toEqual(center(GRAVEYARD))
    expect(center(flight!.toRect)).toEqual(center(COMMAND))
    expect(getImpacts().some((fx) => fx.kind === 'command')).toBe(true)
  })

  it('an aura that entered binds itself to its host once it lands', () => {
    const host = makePermanent({ id: 'host', name: 'Elvish Mystic', attachments: ['aura'] })
    const aura = makePermanent({ id: 'aura', name: 'Rancor', cardTypes: ['Enchantment'], attachedTo: 'host', color: { green: true } as CardView['color'] })
    const prev = makeGameView({ players: [alice({ battlefield: { host: { ...host, attachments: [] } } })], stack: { aura } })
    const next = makeGameView({ players: [alice({ battlefield: { host, aura } })] })
    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(200)
    expect(getImpacts().some((fx) => fx.kind === 'attach')).toBe(false)
    vi.advanceTimersByTime(1000)
    const link = getImpacts().find((fx) => fx.kind === 'attach')
    expect(link).toBeTruthy()
    expect({ x: link!.x, y: link!.y }).toEqual(center(HOST))
    expect({ x: link!.toX, y: link!.toY }).toEqual(center(AURA))
    expect(link!.colors).toEqual(['g'])
  })

  it('a mutating spell flies from the stack onto its host and ripples there, instead of the generic exit', () => {
    const before = makePermanent({ id: 'host', name: 'Elvish Mystic', mutated: false, mutateView: { name: 'Elvish Mystic', id: 'host', cards: {} } as PermanentView['mutateView'] })
    const gemrazer = makeCard({ id: 'gem', name: 'Gemrazer', color: { green: true } as CardView['color'] })
    const after = { ...before, mutated: true, mutateView: { name: 'Elvish Mystic', id: 'host', cards: { host: before, gem: gemrazer } } } as PermanentView
    recordCardPosition('mut-spell', mockRect(810, 320, 40, 56), 'stack-zone')
    const prev = makeGameView({ players: [alice({ battlefield: { host: before } })], stack: { 'mut-spell': { ...gemrazer, id: 'mut-spell', controllerId: 'p-alice' } } })
    const next = makeGameView({ players: [alice({ battlefield: { host: after } })] })
    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(60)
    const flight = getActiveFlights().find((f) => f.cardId === 'mut-spell')
    expect(flight?.variant).toBe('mutate')
    expect(center(flight!.toRect)).toEqual(center(HOST))
    vi.advanceTimersByTime(700)
    expect(getImpacts().some((fx) => fx.kind === 'mutate')).toBe(true)
  })
})
