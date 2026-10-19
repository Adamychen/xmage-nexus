import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PresetPicker from './PresetPicker'
import { applyGameplayPreset, getState, reset } from '../state/store'

afterEach(() => {
  cleanup()
  reset()
})

describe('PresetPicker', () => {
  it('renders the three presets, each with its live mini-demo', () => {
    render(<PresetPicker />)
    for (const id of ['simple', 'balanced', 'manual'] as const) {
      const card = screen.getByTestId(`settings-preset-${id}`)
      const demo = screen.getByTestId(`preset-demo-${id}`)
      expect(card.contains(demo)).toBe(true)
      expect(demo.getAttribute('aria-hidden')).toBe('true')
      expect(demo.querySelectorAll('[data-testid="preset-tile"]').length).toBeGreaterThanOrEqual(4)
    }
  })

  it('shows each preset name exactly once', () => {
    render(<PresetPicker />)
    for (const id of ['simple', 'balanced', 'manual'] as const) {
      expect(screen.getByTestId(`settings-preset-${id}`).querySelectorAll('.settings-card-label')).toHaveLength(1)
    }
  })

  it('paints the mini-demo with the local showcase art (never the network)', () => {
    render(<PresetPicker />)
    const arts = Array.from(document.querySelectorAll<HTMLImageElement>('.preset-tile-art'))
    expect(arts.length).toBeGreaterThanOrEqual(13)
    for (const img of arts) {
      expect(img.getAttribute('src')).toMatch(/^(\/|\.\/)showcase\/.+\.jpg$/)
      expect(img.getAttribute('alt')).toBe('')
    }
  })

  it('applies the clicked preset bundle to the store', () => {
    applyGameplayPreset('manual')
    expect(getState().settings.smartStops).toBe(false)
    render(<PresetPicker />)
    fireEvent.click(screen.getByTestId('settings-preset-simple'))
    const s = getState().settings
    expect(s.gameplayPreset).toBe('simple')
    expect(s.smartStops).toBe(true)
    expect(s.manaPayment.auto).toBe(true)
    expect(screen.getByTestId('settings-preset-simple').className).toContain('selected')
  })

  it('shows stop dots for the stopping presets and none for simple', () => {
    render(<PresetPicker />)
    const stops = (id: string) =>
      screen
        .getByTestId(`preset-demo-${id}`)
        .querySelectorAll('.preset-phase:not([data-stop="none"])').length
    expect(stops('simple')).toBe(0)
    expect(stops('balanced')).toBe(2)
    expect(stops('manual')).toBe(7)
  })
})
