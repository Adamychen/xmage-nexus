import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AppearanceSettingsModal from './AppearanceSettingsModal'
import { getState, setSetting } from '../state/store'

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

  it('offers a custom tile for sleeves and playmats', () => {
    render(<AppearanceSettingsModal onClose={() => {}} />)
    expect(screen.getByTestId('sleeve-custom')).toBeTruthy()
    expect(screen.getByTestId('playmat-custom')).toBeTruthy()
  })
})
