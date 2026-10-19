import { afterEach, describe, expect, it } from 'vitest'
import { boardLayoutChoiceOf, chooseBoardLayout } from './boardLayoutChoice'
import { getState } from '../state/state'
import { setSetting } from '../state/store'

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
})
