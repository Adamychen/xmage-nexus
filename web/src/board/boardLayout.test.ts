import { beforeEach, describe, expect, it } from 'vitest'
import { resolveBoardLayout } from './boardLayout'
import { getState, reset, setSetting } from '../state/store'
import { loadAppearanceSettings } from '../state/persistence'

describe('resolveBoardLayout', () => {
  it('mantiene standard en 1v1 sin elección manual', () => {
    expect(resolveBoardLayout('standard', false, 1)).toBe('standard')
  })

  it('auto-pod con 3+ jugadores salvo override manual', () => {
    expect(resolveBoardLayout('standard', false, 2)).toBe('pod')
    expect(resolveBoardLayout('standard', false, 3)).toBe('pod')
  })

  it('respeta el standard manual en multiplayer', () => {
    expect(resolveBoardLayout('standard', true, 2)).toBe('standard')
    expect(resolveBoardLayout('standard', true, 3)).toBe('standard')
  })

  it('pod explícito siempre es pod', () => {
    expect(resolveBoardLayout('pod', false, 1)).toBe('pod')
    expect(resolveBoardLayout('pod', false, 2)).toBe('pod')
    expect(resolveBoardLayout('pod', true, 3)).toBe('pod')
  })

  it('arena solo en multiplayer, cae a standard en 1v1', () => {
    expect(resolveBoardLayout('arena', true, 2)).toBe('arena')
    expect(resolveBoardLayout('arena', true, 1)).toBe('standard')
  })
})

describe('boardLayout manual override (Ajustes)', () => {
  beforeEach(() => {
    reset()
  })

  it('elegir layout marca manual, persiste y respeta standard en multi', () => {
    setSetting('boardLayout', 'standard')
    expect(getState().settings.boardLayoutManual).toBe(true)
    expect(loadAppearanceSettings()).toMatchObject({ boardLayout: 'standard', boardLayoutManual: true })
    expect(resolveBoardLayout('standard', getState().settings.boardLayoutManual, 2)).toBe('standard')
  })

  it('otros ajustes no marcan manual', () => {
    setSetting('sleeveId', 'classic')
    expect(getState().settings.boardLayoutManual).toBe(false)
  })
})
