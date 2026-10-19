import { afterEach, describe, expect, it, vi } from 'vitest'
import { boardLayoutChoiceOf, chooseBoardLayout } from './boardLayoutChoice'
import { getState } from '../state/state'
import { setSetting } from '../state/store'
import { watchAppearanceStorage } from '../state/actions'
import { APPEARANCE_KEY, loadAppearanceSettings } from '../state/persistence'

describe('board layout choice', () => {
  afterEach(() => {
    setSetting('gameUi', 'v2')
    setSetting('boardLayout', 'standard')
  })

  it('reads as the table whenever the v2 interface is on, and as the stored layout otherwise', () => {
    expect(boardLayoutChoiceOf({ boardLayout: 'pod', gameUi: 'v2' })).toBe('table')
    expect(boardLayoutChoiceOf({ boardLayout: 'pod', gameUi: 'v1' })).toBe('pod')
  })

  it('choosing the table turns v2 on and keeps the stored layout', () => {
    chooseBoardLayout('pod')
    chooseBoardLayout('table')
    expect(getState().settings.gameUi).toBe('v2')
    expect(getState().settings.boardLayout).toBe('pod')
  })

  it('choosing a classic layout turns v2 off and stores that layout', () => {
    chooseBoardLayout('table')
    chooseBoardLayout('arena')
    expect(getState().settings.gameUi).toBe('v1')
    expect(getState().settings.boardLayout).toBe('arena')
    expect(boardLayoutChoiceOf(getState().settings)).toBe('arena')
  })

  it('a tab that predates another tab\'s layout choice does not write the old choice back', () => {
    const memory: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory[key] ?? null,
      setItem: (key: string, value: string) => { memory[key] = value },
      removeItem: (key: string) => { delete memory[key] },
      clear: () => { for (const k of Object.keys(memory)) delete memory[k] },
    })
    const stop = watchAppearanceStorage()
    try {
      chooseBoardLayout('table')
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ ...loadAppearanceSettings(), gameUi: 'v1', boardLayout: 'standard' }))
      window.dispatchEvent(new StorageEvent('storage', { key: APPEARANCE_KEY }))
      expect(getState().settings.gameUi).toBe('v1')
      setSetting('cjkBoost', false)
      expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}')).toMatchObject({ gameUi: 'v1', boardLayout: 'standard' })
    } finally {
      stop()
      vi.unstubAllGlobals()
      setSetting('cjkBoost', true)
    }
  })
})
