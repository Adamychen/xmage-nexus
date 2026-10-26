import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import SettingsModal from './SettingsModal'
import { getState, setSetting } from '../state/store'
import { loadAppearanceSettings, loadGameplayPreset, loadPhaseStops, loadTurnRecap, saveGameplayPreset } from '../state/persistence'
import { t } from '../i18n'
import { normalizeSearch } from './settingsIndex'

afterEach(() => cleanup())

function rowOf(text: string): HTMLElement {
  return screen.getByText(text).closest('.settings-row') as HTMLElement
}

describe('SettingsModal', () => {
  it('SET-4: a side menu of two groups with an icon per section, opening at gameplay', () => {
    render(<SettingsModal onClose={() => {}} />)
    const groups = Array.from(document.querySelectorAll('.settings-nav-group'))
    expect(groups.map((g) => Array.from(g.querySelectorAll('[data-testid^="settings-nav-"]')).map((b) => b.getAttribute('data-testid')))).toEqual([
      ['settings-nav-gameplay', 'settings-nav-board'],
      ['settings-nav-interface', 'settings-nav-language', 'settings-nav-sound'],
    ])
    expect(groups[0].querySelector('.settings-nav-group-label')?.textContent).toBe(t('lobby', 'settings_group_game'))
    expect(groups[1].querySelector('.settings-nav-group-label')?.textContent).toBe(t('lobby', 'settings_group_app'))
    expect(document.querySelectorAll('.settings-nav .settings-nav-icon svg')).toHaveLength(5)
    expect(screen.getByTestId('settings-nav-gameplay').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('settings-nav-board').getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('settings-section-gameplay')).toBeTruthy()
    expect(document.getElementById('settings-title')?.textContent).toBe(t('lobby', 'settings_gameplay'))
    expect(screen.getByText(t('lobby', 'settings_desc_gameplay'))).toBeTruthy()
    expect(document.querySelector('.dlg-kicker')).toBeNull()
    expect(document.querySelector('.settings-footer')).toBeNull()
    expect(document.querySelector('.settings-side')?.contains(screen.getByTestId('settings-review-setup'))).toBe(true)

    fireEvent.click(screen.getByTestId('settings-nav-language'))
    expect(screen.getByTestId('settings-section-language')).toBeTruthy()
    expect(screen.getByTestId('settings-ui-lang').tagName).toBe('SELECT')
    expect(screen.getByTestId('settings-card-lang').tagName).toBe('SELECT')
    expect(screen.getByTestId('settings-nav-language').getAttribute('aria-current')).toBe('page')
    expect(document.getElementById('settings-title')?.textContent).toBe(t('lobby', 'settings_language'))
  })

  it('SET-4: a requested section opens directly', () => {
    render(<SettingsModal onClose={() => {}} initialSection="sound" />)
    expect(screen.getByTestId('settings-section-sound')).toBeTruthy()
    expect(screen.getByTestId('settings-nav-sound').getAttribute('aria-current')).toBe('page')
  })

  it('switches sections and steps zoom from the interface section', () => {
    setSetting('uiScale', 1)
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-interface'))
    const current = screen.getByTestId('settings-zoom-current')
    expect(current.textContent).toBe('100%')
    fireEvent.click(screen.getByTestId('settings-zoom-plus'))
    expect(screen.getByTestId('settings-zoom-current').textContent).toBe('115%')
    fireEvent.click(screen.getByTestId('settings-zoom-1-3'))
    expect(screen.getByTestId('settings-zoom-current').textContent).toBe('130%')
    expect(screen.getByTestId('settings-zoom-1-3').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('settings-zoom-1-15'))
    expect(screen.getByTestId('settings-zoom-current').textContent).toBe('115%')
    setSetting('uiScale', 1)
  })

  it('SET-5: theme and interface size are segmented controls; a disabled row dims its label and explanation together', () => {
    render(<SettingsModal onClose={() => {}} initialSection="interface" />)
    const theme = screen.getByTestId('settings-appearance-dark').closest('.settings-seg') as HTMLElement
    expect(theme.getAttribute('role')).toBe('group')
    expect(theme.querySelectorAll('button')).toHaveLength(3)
    const zoom = screen.getByTestId('settings-zoom-1').closest('.settings-seg') as HTMLElement
    expect(zoom.querySelectorAll('button')).toHaveLength(5)
    expect(document.querySelectorAll('.settings-stops')).toHaveLength(0)

    const cjk = rowOf(t('lobby', 'cjk_boost_label'))
    expect(cjk.classList.contains('is-disabled')).toBe(true)
    const text = cjk.querySelector('.settings-row-text') as HTMLElement
    expect(text.contains(within(cjk).getByText(t('lobby', 'cjk_boost_only')))).toBe(true)
    expect((cjk.querySelector('[role="switch"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('SET-5: every section lays its settings out in titled groups of the same row', () => {
    render(<SettingsModal onClose={() => {}} />)
    for (const id of ['gameplay', 'interface', 'language', 'sound'] as const) {
      fireEvent.click(screen.getByTestId(`settings-nav-${id}`))
      const section = screen.getByTestId(`settings-section-${id}`)
      expect(section.querySelectorAll('.settings-group').length, id).toBeGreaterThan(0)
      expect(section.querySelectorAll('.settings-row').length, id).toBeGreaterThan(0)
      for (const row of Array.from(section.querySelectorAll('.settings-row'))) {
        expect(row.querySelector('.settings-row-label'), id).not.toBeNull()
        expect(row.querySelector('.settings-row-control'), id).not.toBeNull()
      }
    }
    fireEvent.click(screen.getByTestId('settings-nav-sound'))
    expect(document.querySelectorAll('.fx-popover-row')).toHaveLength(0)
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
    fireEvent.click(first)
  })

  it('SET-8: the default phase stops are a table headed by each step, and persist', () => {
    render(<SettingsModal onClose={() => {}} />)
    const block = screen.getByTestId('settings-phase-stops')
    const btns = block.querySelectorAll('.phase-stop-btn')
    expect(btns).toHaveLength(14)
    for (const b of Array.from(btns)) {
      expect(b.classList.contains('active')).toBe(true)
    }
    const head = block.querySelector('.phase-stop-head') as HTMLElement
    expect(Array.from(head.querySelectorAll('.phase-stop-head-code')).map((c) => c.textContent)).toEqual(['UP', 'DR', 'M1', 'BC', 'EC', 'M2', 'ET'])
    expect(within(head).getByText(t('game', 'step_upkeep'))).toBeTruthy()
    expect(within(head).getByText(t('game', 'step_end_step'))).toBeTruthy()
    const main1 = screen.getByTestId('settings-stop-your-main1') as HTMLElement
    fireEvent.click(main1)
    expect(main1.classList.contains('active')).toBe(false)
    expect(loadPhaseStops().yourTurn.main1).toBe(false)
    fireEvent.click(main1)
    expect(main1.classList.contains('active')).toBe(true)
    expect(loadPhaseStops().yourTurn.main1).toBe(true)
  })

  it('SET-8: with no auto-answers the group explains how to create one', () => {
    setSetting('autoAnswers', [])
    render(<SettingsModal onClose={() => {}} />)
    const empty = screen.getByTestId('settings-auto-answers-empty')
    expect(empty.textContent).toContain(t('lobby', 'settings_auto_answers_none'))
    expect(empty.textContent).toContain(t('game', 'auto_answer_remember'))
  })

  it('SET-2: the gameplay section has a turn recap toggle, off by default, that saves its value', () => {
    expect(getState().settings.turnRecap).toBe(false)
    render(<SettingsModal onClose={() => {}} />)
    const toggle = rowOf(t('game', 'recap_setting')).querySelector('[role="switch"]') as HTMLElement
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
    const hint = screen.getByText(t('game', 'smart_stops_hint'))
    expect(hint.classList.contains('settings-row-hint')).toBe(true)
    const row = hint.closest('.settings-row') as HTMLElement
    const label = row.querySelector('.settings-row-label') as HTMLElement
    expect(label.textContent).toBe(t('game', 'smart_stops'))
    const sw = row.querySelector('[role="switch"]') as HTMLElement
    expect(sw.getAttribute('aria-describedby')).toBe(hint.id)
    expect(sw.getAttribute('aria-labelledby')).toBe(label.id)
  })

  it('SET-6: search matches labels and explanations ignoring case and accents, and "Go" opens and highlights the setting', () => {
    render(<SettingsModal onClose={() => {}} initialSection="language" />)
    const label = t('lobby', 'sickness_style_title')
    const word = label.split(/\s+/).sort((a, b) => b.length - a.length)[0]
    fireEvent.change(screen.getByTestId('settings-search'), { target: { value: normalizeSearch(word).toUpperCase() } })
    expect(screen.getByTestId('settings-search-results')).toBeTruthy()
    expect(screen.getByTestId('settings-nav-language').getAttribute('aria-current')).toBeNull()
    const hit = screen.getByTestId('settings-hit-sickness-style')
    expect(hit.textContent).toContain(label)
    expect(hit.querySelector('.settings-hit-where')?.textContent).toContain(t('lobby', 'settings_board'))

    fireEvent.click(screen.getByTestId('settings-go-sickness-style'))
    expect((screen.getByTestId('settings-search') as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('settings-section-board')).toBeTruthy()
    expect(screen.getByTestId('settings-board-tab-overlays').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-setting="sickness-style"]')?.classList.contains('settings-flash')).toBe(true)
  })

  it('SET-6: the search finds a setting by its explanation and says when nothing matches', () => {
    render(<SettingsModal onClose={() => {}} />)
    const hint = t('game', 'rewind_setting_hint')
    const word = hint.split(/\s+/).sort((a, b) => b.length - a.length)[0].replace(/[^\p{L}]/gu, '')
    fireEvent.change(screen.getByTestId('settings-search'), { target: { value: word } })
    expect(screen.getByTestId('settings-hit-board-rewind')).toBeTruthy()

    fireEvent.change(screen.getByTestId('settings-search'), { target: { value: 'zzqqxx' } })
    expect(screen.getByTestId('settings-search-none').textContent).toContain('zzqqxx')
  })

  it('SET-7: the board section has four tabs and every picker has one column per option', () => {
    render(<SettingsModal onClose={() => {}} initialSection="board" />)
    for (const tab of ['layout', 'cards', 'overlays', 'table']) {
      expect(screen.getByTestId(`settings-board-tab-${tab}`)).toBeTruthy()
    }
    expect(screen.getByTestId('board-layout-preview')).toBeTruthy()
    for (const tab of ['layout', 'cards', 'overlays']) {
      fireEvent.click(screen.getByTestId(`settings-board-tab-${tab}`))
      expect(screen.getByTestId(`settings-board-tab-panel-${tab}`)).toBeTruthy()
      for (const grid of Array.from(document.querySelectorAll<HTMLElement>('.settings-cards'))) {
        expect(Number(grid.style.getPropertyValue('--cols')), tab).toBe(grid.children.length)
      }
    }
    expect(screen.getByTestId('board-live-preview')).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-board-tab-table'))
    expect(screen.getByTestId('settings-playmat-classic')).toBeTruthy()
    expect(document.querySelector('.settings-board .appearance-sleeve-grid [data-testid^="settings-sleeve-"]')).toBeTruthy()
  })

  it('SET-7: an on/off option is a switch row with a miniature of its current state', () => {
    setSetting('showManaSource', false)
    render(<SettingsModal onClose={() => {}} initialSection="board" />)
    fireEvent.click(screen.getByTestId('settings-board-tab-overlays'))
    const sw = screen.getByTestId('option-switch-manaSource')
    const row = sw.closest('.settings-row') as HTMLElement
    expect(row.querySelector('[data-testid="option-preview-manaSource-off"]')).not.toBeNull()
    fireEvent.click(sw)
    expect(getState().settings.showManaSource).toBe(true)
    expect(row.querySelector('[data-testid="option-preview-manaSource-on"]')).not.toBeNull()
    setSetting('showManaSource', false)
  })

  it('SET-9: on a phone the dialog starts on the section list and drills into a section with a way back', () => {
    render(<SettingsModal onClose={() => {}} />)
    const layout = document.querySelector('.settings-layout') as HTMLElement
    expect(layout.dataset.view).toBe('list')
    expect(screen.getByTestId('settings-nav-language').querySelector('.settings-nav-value')?.textContent).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-nav-sound'))
    expect(layout.dataset.view).toBe('section')
    fireEvent.click(screen.getByTestId('settings-back'))
    expect(layout.dataset.view).toBe('list')
    cleanup()
    render(<SettingsModal onClose={() => {}} initialSection="gameplay" />)
    expect((document.querySelector('.settings-layout') as HTMLElement).dataset.view).toBe('section')
  })
})
