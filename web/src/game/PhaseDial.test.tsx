import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhaseDial from './PhaseDial'
import { DIAL_PHASES } from './phaseSteps'
import { setState } from '../state/state'

const updatePreferences = vi.fn().mockResolvedValue({ ok: true })
vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  updatePreferences: (...args: unknown[]) => updatePreferences(...args),
}))

describe('PhaseDial', () => {
  beforeEach(() => {
    updatePreferences.mockClear()
    setState({ phaseStops: { yourTurn: { main1: true }, opponentTurn: {} } })
  })
  afterEach(cleanup)

  it('renders one pip per phase, marks the current one and keeps the action in the core', () => {
    const { getByTestId, container } = render(<PhaseDial step="PRECOMBAT_MAIN" action={<button type="button" data-testid="core-action">Pass</button>} />)
    expect(container.querySelectorAll('.phase-dial-pip')).toHaveLength(DIAL_PHASES.length)
    expect(getByTestId('phase-bar-step-PRECOMBAT_MAIN').getAttribute('data-active')).toBe('true')
    expect(getByTestId('phase-bar-step-DRAW').className).toContain('past')
    expect(getByTestId('phase-bar-step-END_TURN').className).not.toContain('past')
    expect(container.querySelector('.phase-dial-core [data-testid="core-action"]')).not.toBeNull()
  })

  it('shows your stops and toggles them from a pip', () => {
    const { getByTestId } = render(<PhaseDial step="UPKEEP" action={null} />)
    expect(getByTestId('phase-bar-step-PRECOMBAT_MAIN').querySelector('.stop-dot-you')).not.toBeNull()
    expect(getByTestId('phase-bar-step-DRAW').querySelector('.stop-dot-you')).toBeNull()
    fireEvent.click(getByTestId('phase-bar-step-DRAW'))
    expect(updatePreferences).toHaveBeenCalledWith({ yourTurn: { main1: true, draw: true }, opponentTurn: { draw: false } })
  })

  it('keeps the combat pip active through every combat step and toggles both combat stops', () => {
    const { getByTestId } = render(<PhaseDial step="COMBAT_DAMAGE" action={null} />)
    expect(getByTestId('phase-bar-step-COMBAT').getAttribute('data-active')).toBe('true')
    expect(getByTestId('phase-bar-step-PRECOMBAT_MAIN').className).toContain('past')
    fireEvent.click(getByTestId('phase-bar-step-COMBAT'))
    expect(updatePreferences).toHaveBeenCalledWith({
      yourTurn: { main1: true, beginCombat: true, endCombat: true },
      opponentTurn: { beginCombat: false, endCombat: false },
    })
  })

  it('toggles the opponent turn stop with the context menu', () => {
    const { getByTestId } = render(<PhaseDial step="UPKEEP" action={null} />)
    fireEvent.contextMenu(getByTestId('phase-bar-step-END_TURN'))
    expect(updatePreferences).toHaveBeenCalledWith({ yourTurn: { main1: true }, opponentTurn: { endStep: true } })
  })

  it('flags the dial while you hold priority', () => {
    const { getByTestId, rerender } = render(<PhaseDial step="UPKEEP" action={null} />)
    expect(getByTestId('phase-dial').className).not.toContain('is-mine')
    rerender(<PhaseDial step="UPKEEP" action={null} mine />)
    expect(getByTestId('phase-dial').className).toContain('is-mine')
  })
})
