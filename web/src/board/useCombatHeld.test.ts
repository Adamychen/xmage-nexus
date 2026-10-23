import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCombatHeld } from './useCombatHeld'
import { clearCombatSnapshots, playDamageStrikes, primeCombatHolds } from './combatStrikes'
import { makeGameView } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

const view = (step: string): GameView =>
  makeGameView({ phase: 'COMBAT', step, combat: [{ attackers: ['a1'], blockers: [], defenderId: 'p-opp' }] as unknown as GameView['combat'] })

describe('useCombatHeld', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearCombatSnapshots()
  })

  afterEach(() => {
    clearCombatSnapshots()
    vi.useRealTimers()
  })

  it('FX-6: keeps the previous value until the strike on that id lands, however late it lands', () => {
    const { result, rerender } = renderHook(({ life }) => useCombatHeld('p-opp', life), { initialProps: { life: 20 } })
    primeCombatHolds(view('DECLARE_BLOCKERS'), view('COMBAT_DAMAGE'))
    rerender({ life: 17 })
    expect(result.current).toBe(20)
    act(() => { vi.advanceTimersByTime(1500) })
    expect(result.current).toBe(20)
    act(() => { playDamageStrikes([{ attackerId: 'a1', targetId: 'p-opp' }], ['a1']) })
    expect(result.current).toBe(20)
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe(17)
  })

  it('FX-6: lets go after a safety net when no strike ever lands', () => {
    const { result, rerender } = renderHook(({ life }) => useCombatHeld('p-opp', life), { initialProps: { life: 20 } })
    primeCombatHolds(view('DECLARE_BLOCKERS'), view('COMBAT_DAMAGE'))
    rerender({ life: 17 })
    act(() => { vi.advanceTimersByTime(3279) })
    expect(result.current).toBe(20)
    act(() => { vi.advanceTimersByTime(2) })
    expect(result.current).toBe(17)
  })

  it('FX-6: follows the value immediately when no strike targets the id', () => {
    const { result, rerender } = renderHook(({ life }) => useCombatHeld('p-me', life), { initialProps: { life: 20 } })
    primeCombatHolds(view('DECLARE_BLOCKERS'), view('COMBAT_DAMAGE'))
    rerender({ life: 23 })
    expect(result.current).toBe(23)
  })

  it('FX-6: jumps to the latest value when it changes again during the hold', () => {
    const { result, rerender } = renderHook(({ life }) => useCombatHeld('p-opp', life), { initialProps: { life: 20 } })
    primeCombatHolds(view('DECLARE_BLOCKERS'), view('COMBAT_DAMAGE'))
    rerender({ life: 17 })
    act(() => { vi.advanceTimersByTime(100) })
    rerender({ life: 19 })
    expect(result.current).toBe(20)
    act(() => { playDamageStrikes([{ attackerId: 'a1', targetId: 'p-opp' }], ['a1']) })
    act(() => { vi.advanceTimersByTime(0) })
    expect(result.current).toBe(19)
  })
})
