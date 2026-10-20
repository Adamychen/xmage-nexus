import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { getActiveFlights, clearFlights } from './flightManager'
import { clearCardPositionRegistry, recordCardPosition } from './cardPositionRegistry'
import { clearFeedbackFx, getFeedbackFxState } from './feedbackFx'
import { makeGameView, makePlayer, makePermanent, makeCard } from '../__fixtures__/gameViews'

const mockRect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

const LIBRARY = mockRect(100, 100, 60, 84)
const GRAVEYARD = mockRect(200, 100, 60, 84)
const EXILE = mockRect(300, 100, 60, 84)
const HAND = mockRect(400, 600, 300, 112)
const HAND_SLOT = mockRect(500, 620)
const STACK = mockRect(800, 300, 250, 400)
const BEAR = mockRect(450, 400)
const PT_BADGE = mockRect(500, 490, 30, 18)

function stub(selector: string, rect: DOMRect): void {
  const el = document.querySelector(selector)
  if (el) vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)
}

function flightOf(name: string) {
  return getActiveFlights().find((f) => f.card.name === name)
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

describe('gameTransitionEngine: piles and P/T (new table chips)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    clearCardPositionRegistry()
    clearFlights()
    clearFeedbackFx()
    document.body.innerHTML = `
      <div class="game-board">
        <div class="player-zone" data-player-id="p-alice" data-player-name="Alice">
          <div class="library-chip"></div>
          <div class="graveyard-chip"></div>
          <div class="exile-chip"></div>
          <div class="hand-zone"><div class="hand-card-slot"><div data-card-id="h-new"></div></div></div>
          <div class="creatures-band">
            <div class="card-slot" data-card-id="bear"><div class="pt-badge"></div></div>
          </div>
        </div>
        <div class="stack-zone"><div data-card-id="spell"><div class="stack-thumb"></div></div></div>
      </div>
    `
    stub('.library-chip', LIBRARY)
    stub('.graveyard-chip', GRAVEYARD)
    stub('.exile-chip', EXILE)
    stub('.hand-zone', HAND)
    stub('.hand-card-slot', HAND_SLOT)
    stub('[data-card-id="h-new"]', HAND_SLOT)
    stub('.stack-zone', STACK)
    stub('[data-card-id="spell"] .stack-thumb', mockRect(810, 320, 40, 56))
    stub('[data-card-id="bear"]', BEAR)
    stub('.pt-badge', PT_BADGE)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCardPositionRegistry()
  })

  it('a permanent exiled on the new table flies to the exile chip', () => {
    const bear = makePermanent({ id: 'gone', name: 'Grizzly Bears' })
    recordCardPosition('gone', BEAR, 'player-zone')
    const prev = makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: { gone: bear } })
    const next = { ...prev, battlefield: {}, exile: { gone: bear } }
    detectAndAnimateTransitions(makeGameView({ players: [prev] }), makeGameView({ players: [next] }))
    vi.advanceTimersByTime(60)
    const flight = flightOf('Grizzly Bears')
    expect(flight?.variant).toBe('exile')
    expect(center(flight!.toRect)).toEqual(center(EXILE))
  })

  it('a card returned from my graveyard to my hand flies from the graveyard pile, not the library', () => {
    const witness = makeCard({ id: 'h-new', name: 'Eternal Witness' })
    const prev = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 0, graveyard: { 'h-new': witness } })
    const next = { ...prev, handCount: 1, graveyard: {} }
    detectAndAnimateTransitions(makeGameView({ players: [prev], myHand: { old: makeCard({ id: 'old', name: 'Forest' }) } }), makeGameView({ players: [next], myHand: { old: makeCard({ id: 'old', name: 'Forest' }), 'h-new': witness } }))
    vi.advanceTimersByTime(60)
    expect(center(flightOf('Eternal Witness')!.fromRect)).toEqual(center(GRAVEYARD))
  })

  it('an opponent card returned from their graveyard flies face up to their hand, with no face-down draw', () => {
    const witness = makeCard({ id: 'opp-g', name: 'Eternal Witness' })
    const prev = makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 2, graveyard: { 'opp-g': witness } })
    const next = { ...prev, handCount: 3, graveyard: {} }
    detectAndAnimateTransitions(makeGameView({ players: [prev] }), makeGameView({ players: [next] }))
    vi.advanceTimersByTime(60)
    const flights = getActiveFlights()
    expect(flights).toHaveLength(1)
    expect(flights[0].card.name).toBe('Eternal Witness')
    expect(center(flights[0].fromRect)).toEqual(center(GRAVEYARD))
  })

  it('cards exiled from the graveyard, my hand and the library fly to the exile chip; the library one turns face up', () => {
    const g = makeCard({ id: 'eg', name: 'From Graveyard' })
    const h = makeCard({ id: 'eh', name: 'From Hand' })
    const l = makeCard({ id: 'el', name: 'From Library' })
    recordCardPosition('eh', HAND_SLOT, 'hand-zone')
    const prev = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 1, graveyard: { eg: g } })
    const next = { ...prev, handCount: 0, graveyard: {}, exile: { eg: g, eh: h, el: l } }
    detectAndAnimateTransitions(makeGameView({ players: [prev], myHand: { eh: h } }), makeGameView({ players: [next], myHand: {} }))
    vi.advanceTimersByTime(250)
    const fromGrave = flightOf('From Graveyard')
    const fromHand = flightOf('From Hand')
    const fromLibrary = flightOf('From Library')
    expect(center(fromGrave!.fromRect)).toEqual(center(GRAVEYARD))
    expect(center(fromHand!.fromRect)).toEqual(center(HAND_SLOT))
    expect(center(fromLibrary!.fromRect)).toEqual(center(LIBRARY))
    for (const f of [fromGrave, fromHand, fromLibrary]) {
      expect(f?.variant).toBe('exile')
      expect(center(f!.toRect)).toEqual(center(EXILE))
    }
    expect(fromLibrary?.reveal).toBe(true)
    expect(fromGrave?.reveal).toBeUndefined()
    expect(fromHand?.reveal).toBeUndefined()
  })

  it('a spell cast from the graveyard lifts out of the graveyard pile; one cast from exile out of the exile chip', () => {
    for (const [pile, rect] of [['graveyard', GRAVEYARD], ['exile', EXILE]] as const) {
      clearFlights()
      const looting = makeCard({ id: 'spell', name: 'Faithless Looting', controllerId: 'p-alice', cardTypes: ['Sorcery'] })
      const prev = makePlayer({ playerId: 'p-alice', name: 'Alice', [pile]: { spell: looting } })
      const next = { ...prev, [pile]: {} }
      detectAndAnimateTransitions(makeGameView({ players: [prev] }), makeGameView({ players: [next], stack: { spell: looting } }))
      vi.advanceTimersByTime(60)
      const flight = flightOf('Faithless Looting')
      expect(center(flight!.fromRect)).toEqual(center(rect))
      expect(flight?.lift).toBe(true)
    }
  })

  it('a pump pops the P/T box green and floats the difference from it; a counter-only change does not', () => {
    const bear = (power: string, toughness: string, counters: Array<{ name: string; count: number }> = []) =>
      makePermanent({ id: 'bear', name: 'Grizzly Bears', power, toughness, counters })
    const at = (perm: ReturnType<typeof bear>) => makeGameView({ players: [makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: { bear: perm } })] })

    detectAndAnimateTransitions(at(bear('2', '2')), at(bear('5', '5')))
    vi.advanceTimersByTime(40)
    expect(document.querySelector('.pt-badge')?.classList.contains('fx-pt-pump')).toBe(true)
    const floater = getFeedbackFxState().floaters.at(-1)
    expect(floater?.text).toBe('+3/+3')
    expect(floater?.tone).toBe('good')
    expect(floater?.x).toBe(center(PT_BADGE).x)

    vi.advanceTimersByTime(2000)
    clearFeedbackFx()
    detectAndAnimateTransitions(at(bear('2', '2')), at(bear('3', '3', [{ name: '+1/+1', count: 1 }])))
    vi.advanceTimersByTime(40)
    expect(getFeedbackFxState().floaters).toHaveLength(0)

    detectAndAnimateTransitions(at(bear('2', '2')), at(bear('4', '1')))
    vi.advanceTimersByTime(40)
    expect(document.querySelector('.pt-badge')?.classList.contains('fx-pt-mixed')).toBe(true)
    expect(getFeedbackFxState().floaters.at(-1)?.tone).toBe('mixed')
  })
})
