import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SettingsModal from './SettingsModal'
import { getState, setSetting } from '../state/store'
import { APPEARANCE_KEY, loadAppearanceSettings } from '../state/persistence'
import { applyAppearanceChoice, normalizeAppearanceChoice } from '../appearance/appearanceChoice'

const mockStorage: Record<string, string> = {}

beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    },
  })
})

afterEach(() => {
  cleanup()
  setSetting('appearance', 'system')
  setSetting('sleeveId', 'classic')
})

describe('appearance setting', () => {
  it('APR-1: the appearance defaults to dark when nothing is stored or the stored value is unknown', () => {
    delete mockStorage[APPEARANCE_KEY]
    expect(loadAppearanceSettings().appearance).toBe('dark')
    expect(normalizeAppearanceChoice('neon')).toBe('dark')
    mockStorage[APPEARANCE_KEY] = JSON.stringify({ sleeveId: 'classic', appearance: 'neon' })
    expect(loadAppearanceSettings().appearance).toBe('dark')
  })

  it('APR-1: the choice is persisted under mage-web-appearance without dropping the other appearance settings', () => {
    setSetting('sleeveId', 'classic')
    setSetting('appearance', 'dark')
    expect(getState().settings.appearance).toBe('dark')
    const stored = JSON.parse(mockStorage[APPEARANCE_KEY])
    expect(stored.appearance).toBe('dark')
    expect(stored.sleeveId).toBe('classic')
    expect(loadAppearanceSettings().appearance).toBe('dark')
    setSetting('appearance', 'light')
    expect(loadAppearanceSettings().appearance).toBe('light')
  })

  it('APR-1: applying dark sets data-appearance on the document element and system removes it', () => {
    applyAppearanceChoice('dark')
    expect(document.documentElement.dataset.appearance).toBe('dark')
    applyAppearanceChoice('light')
    expect(document.documentElement.dataset.appearance).toBe('light')
    applyAppearanceChoice('system')
    expect(document.documentElement.dataset.appearance).toBeUndefined()
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
  })

  it('APR-1: the interface section offers System, Light and Dark and stores the one clicked', () => {
    setSetting('appearance', 'system')
    render(<SettingsModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('settings-nav-interface'))
    expect(screen.getByTestId('settings-appearance-system').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('settings-appearance-dark'))
    expect(getState().settings.appearance).toBe('dark')
    expect(screen.getByTestId('settings-appearance-dark').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('settings-appearance-system').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByTestId('settings-appearance-light'))
    expect(getState().settings.appearance).toBe('light')
    fireEvent.click(screen.getByTestId('settings-appearance-system'))
    expect(getState().settings.appearance).toBe('system')
  })
})
