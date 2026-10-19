import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_UI, normalizeGameUi } from './gameUi'
import { DEFAULT_APPEARANCE, loadAppearanceSettings } from '../state/persistence'

describe('gameUi', () => {
  it('defaults to the new interface and keeps an explicit choice of the classic one', () => {
    expect(DEFAULT_GAME_UI).toBe('v2')
    expect(normalizeGameUi(undefined)).toBe('v2')
    expect(normalizeGameUi('v3')).toBe('v2')
    expect(normalizeGameUi(true)).toBe('v2')
    expect(normalizeGameUi('v1')).toBe('v1')
    expect(normalizeGameUi('v2')).toBe('v2')
  })

  it('is part of the persisted appearance defaults', () => {
    expect(DEFAULT_APPEARANCE.gameUi).toBe('v2')
    expect(loadAppearanceSettings().gameUi).toBe('v2')
  })
})
