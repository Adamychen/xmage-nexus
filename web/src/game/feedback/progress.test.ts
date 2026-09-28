import { describe, expect, it } from 'vitest'
import { stripTargetProgress, targetProgress } from './progress'

describe('targetProgress', () => {
  it('reads selected/max/min from TargetImpl messages', () => {
    expect(targetProgress('Select cards (selected 0 of 2)')).toEqual({ selected: 0, max: 2 })
    expect(targetProgress('Select cards (selected 2 of 5, min 1)', ['a', 'b'])).toEqual({ selected: 2, max: 5, min: 1 })
    expect(targetProgress('Select creatures (selected 1, min 1)')).toEqual({ selected: 1, min: 1 })
  })

  it('reads the London "(N more)" counter', () => {
    expect(targetProgress("Select a card <font color='x'>(3 more)</font> to put on the bottom of your library")).toEqual({ selected: 0, remaining: 3 })
  })

  it('falls back to chosenTargets and returns nothing for plain prompts', () => {
    expect(targetProgress('Select target creature', ['x'])).toEqual({ selected: 1 })
    expect(targetProgress('Select target creature')).toBeUndefined()
  })

  it('strips the counters from the visible message', () => {
    expect(stripTargetProgress('Select cards from your graveyard (selected 1 of 3, min 1)')).toBe('Select cards from your graveyard')
    expect(stripTargetProgress('Select a card (2 more) to put on the bottom of your library')).toBe('Select a card to put on the bottom of your library')
  })
})
