import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SettingsModal from './SettingsModal'
import { setSetting } from '../state/store'
import { loadPhaseStops } from '../state/persistence'

afterEach(() => cleanup())

describe('SettingsModal', () => {
  it('shows a text-only nav with five sections, starting at language', () => {
    render(<SettingsModal onClose={() => {}} />)
    for (const nav of ['settings-nav-language', 'settings-nav-interface', 'settings-nav-board', 'settings-nav-sound', 'settings-nav-gameplay']) {
      expect(screen.getByTestId(nav)).toBeTruthy()
    }
    expect(screen.getByTestId('settings-section-language')).toBeTruthy()
    expect(screen.getByTestId('settings-ui-lang').tagName).toBe('SELECT')
    expect(screen.getByTestId('settings-card-lang').tagName).toBe('SELECT')
    expect(screen.queryByTestId('settings-section-interface')).toBeNull()
    expect(document.querySelector('.settings-nav svg')).toBeNull()
    expect(document.querySelector('.dlg-kicker svg')).not.toBeNull()
  })

  it('switches sections and steps zoom from the interface section', () => {
    setSetting('uiScale', 1)
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-interface'))
    const current = screen.getByTestId('settings-zoom-current')
    expect(current.textContent).toBe('100%')
    fireEvent.click(screen.getByTestId('settings-zoom-plus'))
    expect(screen.getByTestId('settings-zoom-current').textContent).toBe('110%')
    fireEvent.click(screen.getByTestId('settings-zoom-1-15'))
    expect(screen.getByTestId('settings-zoom-current').textContent).toBe('115%')
    setSetting('uiScale', 1)
  })

  it('exposes sound controls and gameplay toggles', () => {
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-sound'))
    expect(screen.getByTestId('settings-sound-card')).toBeTruthy()
    expect(document.querySelector('.settings-content .audio-slider')).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-nav-gameplay'))
    const toggles = document.querySelectorAll('.settings-content .ui-toggle[role="switch"]')
    expect(toggles.length).toBeGreaterThan(0)
    const first = toggles[0] as HTMLElement
    const wasOn = first.classList.contains('on')
    fireEvent.click(first)
    expect(first.classList.contains('on')).toBe(!wasOn)
  })

  it('exposes persistent default phase stops in the gameplay section', () => {
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-gameplay'))
    const block = screen.getByTestId('settings-phase-stops')
    const btns = block.querySelectorAll('.phase-stop-btn')
    expect(btns).toHaveLength(14)
    for (const b of Array.from(btns)) {
      expect(b.classList.contains('active')).toBe(true)
    }
    const main1 = screen.getByTestId('settings-stop-your-main1') as HTMLElement
    fireEvent.click(main1)
    expect(main1.classList.contains('active')).toBe(false)
    expect(loadPhaseStops().yourTurn.main1).toBe(false)
    fireEvent.click(main1)
    expect(main1.classList.contains('active')).toBe(true)
    expect(loadPhaseStops().yourTurn.main1).toBe(true)
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(screen.getByTestId('settings-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
