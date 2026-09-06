import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SettingsModal from './SettingsModal'
import { setSetting } from '../state/store'

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
    expect(document.querySelector('.settings-modal svg')).toBeNull()
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

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(screen.getByTestId('settings-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
