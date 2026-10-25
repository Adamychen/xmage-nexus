import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SettingsModal from './SettingsModal'
import { getState, setSetting } from '../state/store'
import { loadAppearanceSettings, loadGameplayPreset, loadPhaseStops, loadTurnRecap, saveGameplayPreset } from '../state/persistence'
import { t } from '../i18n'

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
    expect(screen.getByTestId('settings-zoom-current').textContent).toBe('115%')
    fireEvent.click(screen.getByTestId('settings-zoom-1-15'))
    expect(screen.getByTestId('settings-zoom-current').textContent).toBe('115%')
    setSetting('uiScale', 1)
  })

  it('SET-1: the interface section has a card preview size slider that sets cardPreviewScale and resets to 100%', () => {
    setSetting('cardPreviewScale', 1)
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-interface'))
    const section = screen.getByTestId('settings-section-interface')
    const slider = screen.getByTestId('settings-card-preview-scale') as HTMLInputElement
    expect(section.contains(slider)).toBe(true)
    expect(slider.type).toBe('range')
    expect(Number(slider.min)).toBe(0.75)
    expect(Number(slider.max)).toBe(2)
    expect(Number(slider.step)).toBe(0.05)
    expect(screen.getByTestId('settings-card-preview-value').textContent).toBe('100%')
    const reset = screen.getByTestId('settings-card-preview-reset') as HTMLButtonElement
    expect(reset.disabled).toBe(true)

    fireEvent.change(slider, { target: { value: '1.45' } })
    expect(getState().settings.cardPreviewScale).toBe(1.45)
    expect(screen.getByTestId('settings-card-preview-value').textContent).toBe('145%')
    expect(loadAppearanceSettings().cardPreviewScale).toBe(1.45)
    expect(reset.disabled).toBe(false)

    fireEvent.click(reset)
    expect(getState().settings.cardPreviewScale).toBe(1)
    expect(screen.getByTestId('settings-card-preview-value').textContent).toBe('100%')
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

  it('SET-2: the gameplay section has a turn recap toggle, off by default, that saves its value', () => {
    expect(getState().settings.turnRecap).toBe(false)
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-gameplay'))
    const row = screen.getByText(t('game', 'recap_setting')).closest('label')!
    const toggle = row.querySelector('[role="switch"]') as HTMLElement
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(toggle)
    expect(getState().settings.turnRecap).toBe(true)
    expect(loadTurnRecap()).toBe(true)

    fireEvent.click(toggle)
    expect(getState().settings.turnRecap).toBe(false)
    expect(loadTurnRecap()).toBe(false)
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(screen.getByTestId('settings-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the gameplay presets and applies one on click', () => {
    saveGameplayPreset(null)
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-gameplay'))
    expect(screen.getByTestId('settings-presets')).toBeTruthy()
    for (const id of ['simple', 'balanced', 'manual']) {
      expect(screen.getByTestId(`settings-preset-${id}`)).toBeTruthy()
    }
    fireEvent.click(screen.getByTestId('settings-preset-simple'))
    expect(screen.getByTestId('settings-preset-simple').className).toContain('selected')
    expect(loadGameplayPreset()).toBe('simple')
    fireEvent.click(screen.getByTestId('settings-preset-balanced'))
    expect(loadGameplayPreset()).toBe('balanced')
    saveGameplayPreset(null)
  })

  it("SET-3: a setting's explanation is visible text under its label", () => {
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-gameplay'))
    const hint = screen.getByText(t('game', 'smart_stops_hint'))
    expect(hint.classList.contains('ui-toggle-hint')).toBe(true)
    const field = hint.closest('.ui-toggle-field') as HTMLElement
    expect(field.querySelector('.ui-toggle-label')?.textContent).toBe(t('game', 'smart_stops'))
    expect(field.querySelector('[role="switch"]')?.getAttribute('aria-describedby')).toBe(hint.id)
  })
})
