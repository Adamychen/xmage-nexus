import { describe, expect, it } from 'vitest'
import { decideStop } from './stopPolicy'
import { PHASES, DEFAULT_PHASE_STOPS, clonePhaseStops, serverPhaseStops } from './phaseStops'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import landDropFrame from '../../fixtures/recorded/land-drop.json'
import dayNightFrame from '../../fixtures/recorded/day-night.json'
import type { GameView } from '../net/types'
import type { PhaseStops } from '../net/commands'

const mana = { basicManaAbilities: [{ id: 'm', value: '{T}: Add {R}.' }], basicPlayAbilities: [], basicCastAbilities: [], other: [] }
const cast = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [{ id: 'c', value: 'Cast Shock' }], other: [] }
const land = { basicManaAbilities: [], basicPlayAbilities: [{ id: 'p', value: 'Play Forest' }], basicCastAbilities: [], other: [] }

const STEPS = ['UPKEEP', 'DRAW', 'PRECOMBAT_MAIN', 'BEGIN_COMBAT', 'END_COMBAT', 'POSTCOMBAT_MAIN', 'END_TURN']
const KEYS = ['upkeep', 'draw', 'main1', 'beginCombat', 'endCombat', 'main2', 'endStep']

const noStops = (): PhaseStops => {
  const row = () => Object.fromEntries(PHASES.map((p) => [p.key, false]))
  return { yourTurn: row(), opponentTurn: row() }
}

const view = (step: string, mine: boolean, objects: Record<string, unknown> = {}): GameView =>
  makeGameView({
    step,
    players: [makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, hasPriority: true, isActive: mine })],
    canPlayObjects: { objects },
  } as never)

describe('decideStop', () => {
  for (const [i, step] of STEPS.entries()) {
    for (const mine of [true, false]) {
      const who = mine ? 'yourTurn' : 'opponentTurn'

      it(`${step} (${who}): a playable land drop stops with every stop off`, () => {
        expect(decideStop(view(step, mine, { forest: land }), noStops())).toEqual({ action: 'stop', reason: 'playable' })
      })

      it(`${step} (${who}): a castable spell stops with every stop off`, () => {
        expect(decideStop(view(step, mine, { shock: cast, bf: mana }), noStops())).toEqual({ action: 'stop', reason: 'playable' })
      })

      it(`${step} (${who}): only mana sources and no stop passes`, () => {
        expect(decideStop(view(step, mine, { bf: mana }), noStops())).toEqual({ action: 'pass', reason: 'nothing-to-do' })
      })

      it(`${step} (${who}): a marked stop holds an empty window`, () => {
        const stops = noStops()
        stops[who][KEYS[i]] = true
        expect(decideStop(view(step, mine), stops)).toEqual({ action: 'stop', reason: 'user-stop' })
      })

      it(`${step} (${who}): a stop on the other side of the table does not hold it`, () => {
        const stops = noStops()
        stops[mine ? 'opponentTurn' : 'yourTurn'][KEYS[i]] = true
        expect(decideStop(view(step, mine), stops).action).toBe('pass')
      })
    }
  }

  it('steps without a configurable stop never hold an empty window', () => {
    for (const step of ['DECLARE_ATTACKERS', 'DECLARE_BLOCKERS', 'COMBAT_DAMAGE', 'CLEANUP']) {
      expect(decideStop(view(step, true), clonePhaseStops(DEFAULT_PHASE_STOPS)).action).toBe('pass')
    }
  })

  it('real frame: land in hand on the first main phase stops even with every stop off', () => {
    const game = (landDropFrame as unknown as { gameView: GameView }).gameView
    expect(decideStop(game, noStops())).toEqual({ action: 'stop', reason: 'playable' })
  })

  it('real frame: an opponent-turn window with only untapped lands passes with every stop off', () => {
    const game = (dayNightFrame as unknown as { gameView: GameView }).gameView
    expect(decideStop(game, noStops()).action).toBe('pass')
  })
})

describe('serverPhaseStops', () => {
  it('keeps every server stop on while smart stops decide, so the engine never skips a main phase on its own', () => {
    expect(serverPhaseStops(true, noStops())).toEqual(DEFAULT_PHASE_STOPS)
  })

  it('hands the user stops to the engine when smart stops are off', () => {
    const custom = noStops()
    custom.yourTurn.main1 = true
    expect(serverPhaseStops(false, custom)).toEqual(custom)
  })

  it('returns an independent copy', () => {
    const out = serverPhaseStops(true, noStops())
    out.yourTurn.main1 = false
    expect(DEFAULT_PHASE_STOPS.yourTurn.main1).toBe(true)
  })
})
