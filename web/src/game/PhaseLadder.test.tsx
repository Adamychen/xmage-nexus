import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhaseLadder from './PhaseLadder'
import { getState, reset, setSetting } from '../state/store'
import { setLanguage } from '../i18n'
import { DEFAULT_PHASE_STOPS, clonePhaseStops } from './phaseStops'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true })
const opp = makePlayer({ playerId: 'o1', name: 'Bob' })

function game(step: string, active: 'me' | 'o1', players = [me, opp]): GameView {
  return makeGameView({ players, activePlayerId: active, step })
}

function stops(yourMain1: boolean, oppMain1: boolean) {
  const s = clonePhaseStops(DEFAULT_PHASE_STOPS)
  s.yourTurn.main1 = yourMain1
  s.opponentTurn.main1 = oppMain1
  setSetting('phaseStops', s)
}

function step(container: HTMLElement, key: string): HTMLButtonElement {
  return container.querySelector(`[data-testid="phase-ladder-step-${key}"]`) as HTMLButtonElement
}

beforeEach(() => {
  reset()
  setLanguage('en')
  setSetting('phaseStops', clonePhaseStops(DEFAULT_PHASE_STOPS))
})
afterEach(cleanup)

describe('PhaseLadder', () => {
  it('BRD-62: lights the step being played, dims the ones behind it', () => {
    const { container } = render(<PhaseLadder game={game('BEGIN_COMBAT', 'me')} />)
    expect(container.querySelector('[data-testid="phase-ladder"]')?.getAttribute('data-shown-turn')).toBe('yourTurn')
    expect(step(container, 'BEGIN_COMBAT').classList.contains('is-current')).toBe(true)
    expect(step(container, 'UPKEEP').classList.contains('is-past')).toBe(true)
    expect(step(container, 'END_TURN').classList.contains('is-past')).toBe(false)
    expect(step(container, 'END_TURN').classList.contains('is-current')).toBe(false)
  })

  it('BRD-62: on your turn a click edits your stop and a right click the opponent one', () => {
    const { container } = render(<PhaseLadder game={game('UPKEEP', 'me')} />)
    fireEvent.click(step(container, 'PRECOMBAT_MAIN'))
    expect(getState().settings.phaseStops.yourTurn.main1).toBe(false)
    expect(getState().settings.phaseStops.opponentTurn.main1).toBe(true)
    fireEvent.contextMenu(step(container, 'PRECOMBAT_MAIN'))
    expect(getState().settings.phaseStops.yourTurn.main1).toBe(false)
    expect(getState().settings.phaseStops.opponentTurn.main1).toBe(false)
  })

  it('BRD-62: on the opponent turn a click edits the opponent stop', () => {
    const { container } = render(<PhaseLadder game={game('UPKEEP', 'o1')} />)
    fireEvent.click(step(container, 'PRECOMBAT_MAIN'))
    expect(getState().settings.phaseStops.opponentTurn.main1).toBe(false)
    expect(getState().settings.phaseStops.yourTurn.main1).toBe(true)
  })

  it('BRD-62: a notch marks a stop in the turn shown, a dot one in the other turn, both at once', () => {
    stops(false, true)
    const { container, rerender } = render(<PhaseLadder game={game('UPKEEP', 'o1')} />)
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-notch')).not.toBeNull()
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-dot')).toBeNull()
    rerender(<PhaseLadder game={game('UPKEEP', 'me')} />)
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-notch')).toBeNull()
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-dot')).not.toBeNull()
    act(() => stops(true, true))
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-notch')).not.toBeNull()
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-dot')).not.toBeNull()
  })

  it('BRD-62: a right click shows its change even when the shown turn already stops there', () => {
    stops(true, false)
    const { container } = render(<PhaseLadder game={game('UPKEEP', 'me')} />)
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-dot')).toBeNull()
    fireEvent.contextMenu(step(container, 'PRECOMBAT_MAIN'))
    expect(getState().settings.phaseStops.opponentTurn.main1).toBe(true)
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-dot')).not.toBeNull()
    expect(step(container, 'PRECOMBAT_MAIN').querySelector('.ladder-stop-notch')).not.toBeNull()
  })

  it('BRD-62: the combat steps fold under one combat icon that opens on hover and during combat', () => {
    const { container, rerender } = render(<PhaseLadder game={game('PRECOMBAT_MAIN', 'me')} />)
    const combat = container.querySelector('.ladder-combat') as HTMLElement
    const flyout = combat.querySelector('[data-testid="phase-ladder-combat-steps"]') as HTMLElement
    expect(flyout.querySelectorAll('.ladder-step')).toHaveLength(5)
    expect(combat.classList.contains('is-open')).toBe(false)
    fireEvent.mouseEnter(combat)
    expect(combat.classList.contains('is-open')).toBe(true)
    fireEvent.mouseLeave(combat)
    expect(combat.classList.contains('is-open')).toBe(false)
    rerender(<PhaseLadder game={game('DECLARE_BLOCKERS', 'me')} />)
    expect(combat.classList.contains('is-open')).toBe(true)
    expect(step(container, 'COMBAT').classList.contains('is-current')).toBe(true)
    expect(step(container, 'DECLARE_BLOCKERS').classList.contains('is-current')).toBe(true)
  })

  it('BRD-62: the combat icon carries a notch when the shown turn stops in combat', () => {
    const s = clonePhaseStops(DEFAULT_PHASE_STOPS)
    s.yourTurn.beginCombat = false
    s.yourTurn.endCombat = false
    setSetting('phaseStops', s)
    const { container } = render(<PhaseLadder game={game('UPKEEP', 'me')} />)
    expect(step(container, 'COMBAT').querySelector('.ladder-stop-notch')).toBeNull()
    expect(step(container, 'COMBAT').querySelector('.ladder-stop-dot')).not.toBeNull()
  })

  it('BRD-62: cleanup lights the end step icon', () => {
    const { container } = render(<PhaseLadder game={game('CLEANUP', 'me')} />)
    expect(step(container, 'END_TURN').classList.contains('is-current')).toBe(true)
  })

  it('BRD-62: a step with no stop lights up as a static indicator and a click changes nothing', () => {
    const before = JSON.stringify(getState().settings.phaseStops)
    const { container } = render(<PhaseLadder game={game('DECLARE_ATTACKERS', 'me')} />)
    const atk = step(container, 'DECLARE_ATTACKERS')
    expect(atk.classList.contains('is-current')).toBe(true)
    expect(atk.classList.contains('is-static')).toBe(true)
    expect(atk.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(atk)
    fireEvent.contextMenu(atk)
    expect(JSON.stringify(getState().settings.phaseStops)).toBe(before)
  })

  it('BRD-62: combat docks space above the ladder during combat or while pinned, and unpins on Escape or outside click', () => {
    const { container, rerender } = render(<PhaseLadder game={game('PRECOMBAT_MAIN', 'me')} />)
    const wrap = container.querySelector('.phase-ladder-wrap') as HTMLElement
    expect(wrap.classList.contains('has-combat-docked')).toBe(false)

    fireEvent.click(step(container, 'COMBAT'))
    expect(wrap.classList.contains('has-combat-docked')).toBe(true)
    expect(step(container, 'COMBAT').classList.contains('is-pinned')).toBe(true)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(wrap.classList.contains('has-combat-docked')).toBe(false)

    fireEvent.click(step(container, 'COMBAT'))
    expect(wrap.classList.contains('has-combat-docked')).toBe(true)
    fireEvent.pointerDown(document.body)
    expect(wrap.classList.contains('has-combat-docked')).toBe(false)

    rerender(<PhaseLadder game={game('DECLARE_BLOCKERS', 'me')} />)
    expect(wrap.classList.contains('has-combat-docked')).toBe(true)
  })

  it('BRD-62: hovering a step opens an instant tooltip with step name, stops and smart-stop hint', () => {
    setSetting('smartStops', true)
    const { container } = render(<PhaseLadder game={game('UPKEEP', 'me')} />)
    expect(container.querySelector('[data-testid="phase-ladder-tooltip"]')).toBeNull()
    fireEvent.mouseEnter(step(container, 'PRECOMBAT_MAIN'))
    const tip = container.querySelector('[data-testid="phase-ladder-tooltip"]') as HTMLElement
    expect(tip).not.toBeNull()
    expect(tip.textContent).toContain('Main Phase 1')
    expect(tip.textContent).toContain('Smart stops')
    fireEvent.mouseLeave(step(container, 'PRECOMBAT_MAIN'))
    expect(container.querySelector('[data-testid="phase-ladder-tooltip"]')).toBeNull()
  })

  it('BRD-62: touch long-press toggles the other turn stop', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<PhaseLadder game={game('UPKEEP', 'me')} />)
      const m1 = step(container, 'PRECOMBAT_MAIN')
      fireEvent.touchStart(m1)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      fireEvent.touchEnd(m1)
      expect(getState().settings.phaseStops.opponentTurn.main1).toBe(false)
      expect(getState().settings.phaseStops.yourTurn.main1).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('BRD-62: a spectator sees the step but cannot edit stops', () => {
    const before = JSON.stringify(getState().settings.phaseStops)
    const spectated = game('PRECOMBAT_MAIN', 'o1', [makePlayer({ playerId: 'o1', name: 'Bob' }), makePlayer({ playerId: 'o2', name: 'Carol' })])
    const { container } = render(<PhaseLadder game={spectated} />)
    expect(container.querySelector('[data-testid="phase-ladder"]')?.hasAttribute('data-shown-turn')).toBe(false)
    expect(step(container, 'PRECOMBAT_MAIN').classList.contains('is-current')).toBe(true)
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.ladder-step'))
    expect(buttons.every((b) => b.disabled)).toBe(true)
    fireEvent.click(step(container, 'UPKEEP'))
    expect(JSON.stringify(getState().settings.phaseStops)).toBe(before)
  })

  it('BRD-62: a step off the ladder lights nothing', () => {
    const { container } = render(<PhaseLadder game={game('UNTAP', 'me')} />)
    expect(container.querySelectorAll('.ladder-step.is-current')).toHaveLength(0)
  })

  it('BRD-62: icons carry the step name for assistive tech and no text code', () => {
    const { container } = render(<PhaseLadder game={game('UPKEEP', 'me')} />)
    expect(step(container, 'UPKEEP').getAttribute('aria-label')).toContain('Upkeep')
    expect(container.querySelector('[data-testid="phase-ladder"]')?.textContent).toBe('')
  })
})
