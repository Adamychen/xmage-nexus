import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { getActiveFlights, clearFlights } from './flightManager'
import { clearCardPositionRegistry, recordCardPosition } from './cardPositionRegistry'
import { clearFeedbackFx, getFeedbackFxState } from './feedbackFx'
import { clearImpacts, getImpacts } from './impactFx'
import { clearBoardWipe } from './boardWipe'
import { makeGameView, makePlayer, makePermanent } from '../__fixtures__/gameViews'
import type { PermanentView } from '../net/types'

const mockRect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

function stub(selector: string, rect: DOMRect): void {
  const el = document.querySelector(selector)
  if (el) vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)
}

const impactsOf = (kind: string) => getImpacts().filter((fx) => fx.kind === kind)
const bear = (id: string, extra: Partial<PermanentView> = {}) => makePermanent({ id, name: `Bear ${id}`, ...extra })

describe('gameTransitionEngine: board wipe, face up, player counters, control', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    clearCardPositionRegistry()
    clearFlights()
    clearFeedbackFx()
    clearImpacts()
    clearBoardWipe()
    document.body.innerHTML = `
      <div class="board-shell">
        <div class="player-zone" data-player-id="me" data-player-name="Alice">
          <div class="graveyard-stack"></div>
          <div class="creatures-band"><div class="card-slot" data-card-id="m"></div><div class="card-slot" data-card-id="e"></div></div>
        </div>
        <div class="opponent-zone" data-player-id="opp" data-player-name="Bob">
          <div class="graveyard-stack"></div>
          <div class="creatures-band"></div>
        </div>
        <div class="player-info-bar" data-player-id="opp"><span class="player-counter-badge" data-counter="poison"></span><span class="player-counter-badge" data-counter="energy"></span></div>
      </div>
    `
    stub('.board-shell', mockRect(0, 0, 1000, 700))
    stub('[data-player-id="me"] .graveyard-stack', mockRect(900, 500, 60, 84))
    stub('[data-player-id="opp"] .graveyard-stack', mockRect(900, 50, 60, 84))
    stub('[data-player-id="me"] .creatures-band', mockRect(100, 450, 700, 112))
    stub('[data-player-id="opp"] .creatures-band', mockRect(100, 120, 700, 112))
    stub('.card-slot[data-card-id="m"]', mockRect(300, 450))
    stub('.card-slot[data-card-id="e"]', mockRect(420, 450))
    stub('.player-info-bar[data-player-id="opp"]', mockRect(20, 20, 200, 40))
    stub('[data-counter="poison"]', mockRect(150, 30, 30, 18))
    stub('[data-counter="energy"]', mockRect(185, 30, 30, 18))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    clearCardPositionRegistry()
    clearBoardWipe()
  })

  it('a wrath plays one wave and a shake, and each death follows the wave left to right', () => {
    const mine = { a: bear('a'), b: bear('b') }
    const theirs = { c: bear('c'), d: bear('d') }
    recordCardPosition('a', mockRect(60, 450), 'player-zone')
    recordCardPosition('b', mockRect(700, 450), 'player-zone')
    recordCardPosition('c', mockRect(320, 120), 'opponent-zone')
    recordCardPosition('d', mockRect(880, 120), 'opponent-zone')
    const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true, battlefield: mine })
    const opp = makePlayer({ playerId: 'opp', name: 'Bob', battlefield: theirs })
    detectAndAnimateTransitions(
      makeGameView({ players: [me, opp] }),
      makeGameView({ players: [{ ...me, battlefield: {}, graveyard: mine }, { ...opp, battlefield: {}, graveyard: theirs }] }),
    )
    expect(impactsOf('wipe')).toHaveLength(1)
    vi.advanceTimersByTime(160)
    expect(document.querySelector('.board-shell')?.classList.contains('fx-quake-2')).toBe(true)
    const started = (name: string) => getActiveFlights().some((f) => f.card.name === name)
    vi.advanceTimersByTime(100)
    expect(started('Bear a')).toBe(true)
    expect(started('Bear c')).toBe(false)
    vi.advanceTimersByTime(190)
    expect(started('Bear c')).toBe(true)
    expect(started('Bear b')).toBe(false)
    vi.advanceTimersByTime(400)
    expect(started('Bear b') && started('Bear d')).toBe(true)
    expect(getActiveFlights().every((f) => f.variant === 'destroy')).toBe(true)
  })

  it('three deaths are no wipe and die at once', () => {
    const mine = { a: bear('a'), b: bear('b'), c: bear('c') }
    for (const id of Object.keys(mine)) recordCardPosition(id, mockRect(100 + id.charCodeAt(0), 450), 'player-zone')
    const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true, battlefield: mine })
    detectAndAnimateTransitions(makeGameView({ players: [me] }), makeGameView({ players: [{ ...me, battlefield: {}, graveyard: mine }] }))
    expect(impactsOf('wipe')).toHaveLength(0)
    vi.advanceTimersByTime(60)
    expect(getActiveFlights()).toHaveLength(3)
  })

  it('a morph turned face up flips in the dark and bursts out lit', () => {
    const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true, battlefield: { m: bear('m', { name: 'Morph: Den Protector', faceDown: true, morphed: true }) } })
    const revealed = { ...me, battlefield: { m: bear('m', { name: 'Den Protector', color: { green: true } }) } }
    detectAndAnimateTransitions(makeGameView({ players: [me] }), makeGameView({ players: [revealed] }))
    vi.advanceTimersByTime(40)
    expect(document.querySelector('.card-slot[data-card-id="m"]')?.classList.contains('fx-face-up')).toBe(true)
    expect(impactsOf('face-up')).toEqual([expect.objectContaining({ colors: ['g'] })])
    expect(impactsOf('transform')).toHaveLength(0)
  })

  it('a poison counter drips toxic green off its badge and floats +1; the tenth bursts a cloud over the seat', () => {
    const opp = makePlayer({ playerId: 'opp', name: 'Bob', counters: [] })
    detectAndAnimateTransitions(makeGameView({ players: [opp] }), makeGameView({ players: [{ ...opp, counters: [{ name: 'poison', count: 1 }] }] }))
    vi.advanceTimersByTime(40)
    expect(getFeedbackFxState().floaters).toEqual([expect.objectContaining({ text: '+1', tone: 'poison', boxed: true, x: 165 })])
    expect(impactsOf('poison')).toHaveLength(1)
    expect(impactsOf('poison-lethal')).toHaveLength(0)

    const nine = { ...opp, counters: [{ name: 'poison', count: 9 }] }
    detectAndAnimateTransitions(makeGameView({ players: [nine] }), makeGameView({ players: [{ ...opp, counters: [{ name: 'poison', count: 10 }] }] }))
    vi.advanceTimersByTime(40)
    expect(impactsOf('poison-lethal')).toEqual([expect.objectContaining({ x: 120, y: 40 })])
  })

  it('energy cracks a yellow bolt; any other counter just floats its change', () => {
    const opp = makePlayer({ playerId: 'opp', name: 'Bob', counters: [{ name: 'energy', count: 3 }, { name: 'experience', count: 1 }] })
    detectAndAnimateTransitions(makeGameView({ players: [opp] }), makeGameView({ players: [{ ...opp, counters: [{ name: 'energy', count: 1 }, { name: 'experience', count: 2 }] }] }))
    vi.advanceTimersByTime(40)
    expect(impactsOf('energy')).toHaveLength(1)
    const floaters = getFeedbackFxState().floaters
    expect(floaters).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: '-2', tone: 'energy' }),
      expect.objectContaining({ text: '+1', tone: 'mixed' }),
    ]))
  })

  it('a stolen permanent is pulled across by a tether in its new controller\'s colour, not entered or faded', () => {
    const elf = bear('e', { name: 'Elvish Mystic' })
    const token = bear('t', { name: 'Soldier', isToken: true })
    recordCardPosition('e', mockRect(400, 120), 'opponent-zone')
    recordCardPosition('t', mockRect(520, 120), 'opponent-zone')
    const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true })
    const opp = makePlayer({ playerId: 'opp', name: 'Bob', battlefield: { e: elf, t: token } })
    detectAndAnimateTransitions(
      makeGameView({ players: [me, opp] }),
      makeGameView({ players: [{ ...me, battlefield: { e: elf, t: token } }, { ...opp, battlefield: {} }] }),
    )
    vi.advanceTimersByTime(60)
    const flight = getActiveFlights().find((f) => f.cardId === 'e')
    expect(flight).toMatchObject({ variant: 'control', tint: 'var(--seat-0)' })
    expect(getActiveFlights().some((f) => f.variant === 'enter' || f.variant === 'land')).toBe(false)
    expect(impactsOf('control')).toEqual(expect.arrayContaining([expect.objectContaining({ x: 440, y: 176, toX: 460, toY: 506, tint: 'var(--seat-0)' })]))
    expect(impactsOf('token-fade')).toHaveLength(0)
  })

  it('control returning to its owner wears the owner\'s seat colour', () => {
    const elf = bear('e', { name: 'Elvish Mystic' })
    recordCardPosition('e', mockRect(420, 450), 'player-zone')
    document.querySelector('[data-player-id="opp"] .creatures-band')!.innerHTML = '<div class="card-slot" data-card-id="e"></div>'
    stub('[data-player-id="opp"] .card-slot[data-card-id="e"]', mockRect(300, 120))
    const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true, battlefield: { e: elf } })
    const opp = makePlayer({ playerId: 'opp', name: 'Bob' })
    detectAndAnimateTransitions(makeGameView({ players: [me, opp] }), makeGameView({ players: [{ ...me, battlefield: {} }, { ...opp, battlefield: { e: elf } }] }))
    vi.advanceTimersByTime(60)
    expect(getActiveFlights().find((f) => f.cardId === 'e')).toMatchObject({ variant: 'control', tint: 'var(--seat-1)' })
  })
})
