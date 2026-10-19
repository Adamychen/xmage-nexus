import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PhaseBar from './PhaseBar'

afterEach(() => cleanup())

describe('PhaseBar wipe', () => {
  it('marks the active segment with phase-wipe when the step changes and clears it on animationend', () => {
    const { rerender, getByTestId } = render(<PhaseBar step="PRECOMBAT_MAIN" />)
    const m1 = getByTestId('phase-bar-step-PRECOMBAT_MAIN')
    expect(m1.classList.contains('phase-wipe')).toBe(false)

    rerender(<PhaseBar step="BEGIN_COMBAT" />)
    const bc = getByTestId('phase-bar-step-BEGIN_COMBAT')
    expect(bc.classList.contains('active')).toBe(true)
    expect(bc.classList.contains('phase-wipe')).toBe(true)

    fireEvent.animationEnd(bc)
    expect(bc.classList.contains('phase-wipe')).toBe(false)
  })

  it('does not re-arm the wipe when re-rendered with the same step', () => {
    const { rerender, getByTestId } = render(<PhaseBar step="PRECOMBAT_MAIN" />)
    rerender(<PhaseBar step="BEGIN_COMBAT" />)
    const bc = getByTestId('phase-bar-step-BEGIN_COMBAT')
    fireEvent.animationEnd(bc)

    rerender(<PhaseBar step="BEGIN_COMBAT" />)
    expect(bc.classList.contains('phase-wipe')).toBe(false)
  })
})
