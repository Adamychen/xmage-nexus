import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { getActiveFlights } from './flightManager'
import { makeGameView, makePlayer, makePermanent, makeCard } from '../__fixtures__/gameViews'

describe('gameTransitionEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <div class="game-board">
        <div class="player-zone" data-player-id="p-alice" data-player-name="Alice">
          <div class="library-stack" style="width: 80px; height: 112px;"></div>
          <div class="hand-zone" style="width: 300px; height: 112px;"></div>
          <div class="creatures-band" style="width: 500px; height: 112px;">
            <div data-card-id="perm-grizzly" style="width: 80px; height: 112px;"></div>
          </div>
          <div class="graveyard-stack" style="width: 80px; height: 112px;"></div>
        </div>
        <div class="stack-zone" style="width: 250px; height: 400px;"></div>
      </div>
    `

    const mockRect = (left: number, top: number, width = 80, height = 112): DOMRect =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => {},
      } as DOMRect)

    const lib = document.querySelector('.library-stack')
    if (lib) vi.spyOn(lib, 'getBoundingClientRect').mockReturnValue(mockRect(100, 100))

    const hand = document.querySelector('.hand-zone')
    if (hand) vi.spyOn(hand, 'getBoundingClientRect').mockReturnValue(mockRect(400, 600, 300, 112))

    const stack = document.querySelector('.stack-zone')
    if (stack) vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue(mockRect(800, 300, 250, 400))

    const grave = document.querySelector('.graveyard-stack')
    if (grave) vi.spyOn(grave, 'getBoundingClientRect').mockReturnValue(mockRect(200, 100))

    const grizzly = document.querySelector('[data-card-id="perm-grizzly"]')
    if (grizzly) vi.spyOn(grizzly, 'getBoundingClientRect').mockReturnValue(mockRect(450, 400))
  })

  it('detects card draws from library to hand', () => {
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 3 })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 4 })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(50)

    const flights = getActiveFlights()
    expect(flights.length).toBeGreaterThan(0)
  })

  it('detects spells cast to the stack', () => {
    const bolt = makeCard({ id: 'spell-bolt', name: 'Lightning Bolt', controllerId: 'p-alice' })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })

    const prevGame = makeGameView({ players: [alice], stack: {} })
    const nextGame = makeGameView({ players: [alice], stack: { 'spell-bolt': bolt } })

    detectAndAnimateTransitions(prevGame, nextGame)

    const flights = getActiveFlights()
    expect(flights.some((f) => f.card.name === 'Lightning Bolt')).toBe(true)
  })

  it('detects creatures dying and flying to the graveyard', () => {
    const grizzly = makePermanent({ id: 'perm-grizzly', name: 'Grizzly Bears' })
    const alice1 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: { 'perm-grizzly': grizzly },
    })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: {},
    })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)

    const flights = getActiveFlights()
    expect(flights.some((f) => f.card.name === 'Grizzly Bears')).toBe(true)
  })
})
