import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AppearanceSettingsModal from './AppearanceSettingsModal'
import { getState, setSetting } from '../state/store'
import { t as tStatic } from '../i18n'

afterEach(() => {
  setSetting('playmatId', 'classic')
  setSetting('sleeveId', 'classic')
  cleanup()
})

describe('AppearanceSettingsModal', () => {
  it('picks a built-in playmat from the picker', () => {
    render(<AppearanceSettingsModal onClose={() => {}} />)
    const tile = screen.getByTestId('playmat-ember')
    fireEvent.click(tile)
    expect(getState().settings.playmatId).toBe('ember')
    expect(tile.getAttribute('aria-pressed')).toBe('true')
  })

  it('stages real card art on the playmat tiles (showcase set, local files)', () => {
    render(<AppearanceSettingsModal onClose={() => {}} />)
    const ember = screen.getByTestId('playmat-ember')
    const arts = ember.querySelectorAll('img.playmat-table-card')
    expect(arts.length).toBe(3)
    for (const img of Array.from(arts)) {
      expect(img.getAttribute('src')).toMatch(/showcase\/.+\.jpg$/)
      expect(img.getAttribute('alt')).toBe('')
    }
  })

  it('offers a custom tile for sleeves and playmats', () => {
    render(<AppearanceSettingsModal onClose={() => {}} />)
    expect(screen.getByTestId('sleeve-custom')).toBeTruthy()
    expect(screen.getByTestId('playmat-custom')).toBeTruthy()
  })
})
describe('AppearanceSettingsModal keyword effects', () => {
  it('titles the keyword effect choices with a heading and hint', () => {
    render(<AppearanceSettingsModal onClose={() => {}} />)
    expect(screen.getByText(tStatic('lobby', 'keyword_aura_title'))).toBeTruthy()
    expect(screen.getByText(tStatic('lobby', 'keyword_aura_hint'))).toBeTruthy()
  })
})
