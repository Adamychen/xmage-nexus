import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PhaseStopSelector from './PhaseStopSelector'
import { reset, setSetting } from '../state/store'
import { t, setLanguage } from '../i18n'
import { DEFAULT_PHASE_STOPS } from './phaseStops'

vi.mock('../net/commands', () => ({
  updatePreferences: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('PhaseStopSelector', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
    setLanguage('es')
  })

  it('renders rows for your turn and opponent turn', () => {
    setLanguage('en')
    const { container } = render(<PhaseStopSelector />)
    expect(container.textContent).toContain(t('game', 'phase_you'))
    expect(container.textContent).toContain(t('game', 'phase_opp'))
  })

  it('renders all 7 phase abbreviations', () => {
    const { container } = render(<PhaseStopSelector />)
    const btns = container.querySelectorAll('.phase-stop-btn')
    const labels = Array.from(btns).map((b) => b.textContent)
    for (const abbr of ['UP', 'DR', 'M1', 'BC', 'EC', 'M2', 'ET']) {
      expect(labels.filter((l) => l === abbr).length).toBe(2)
    }
  })

  it('has 14 phase stop buttons total', () => {
    const { container } = render(<PhaseStopSelector />)
    const allBtns = container.querySelectorAll('.phase-stop-btn')
    expect(allBtns.length).toBe(14)
  })

  it('draws the stops it is given, on and off', () => {
    const active = () => {
      const { container } = render(<PhaseStopSelector />)
      return Array.from(container.querySelectorAll('.phase-stop-btn')).filter((b) => b.classList.contains('active')).length
    }
    // SET-15: a player who has set nothing stops on no step by hand.
    expect(active()).toBe(0)
    setSetting('phaseStops', DEFAULT_PHASE_STOPS)
    expect(active()).toBe(14)
  })
})
