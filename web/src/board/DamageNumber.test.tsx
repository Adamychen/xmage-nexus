import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DamageNumber, DamageNumbers, dismissDamageNumber, spawnDamageNumber, useDamageNumbers } from './DamageNumber'
import { getState, setSetting } from '../state/store'

describe('DamageNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setSetting('effects', true)
  })

  afterEach(() => {
    vi.useRealTimers()
    setSetting('effects', true)
  })

  it('renders the amount with a minus sign', () => {
    render(<DamageNumber amount={3} onDone={vi.fn()} />)
    expect(screen.getByText('-3').className).toContain('damage-number')
  })

  it('calls onDone when its animation ends', () => {
    const onDone = vi.fn()
    const { container } = render(<DamageNumber amount={3} onDone={onDone} />)
    fireEvent.animationEnd(container.querySelector('.damage-number')!)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone from the backstop timer when no animation end arrives', () => {
    const onDone = vi.fn()
    render(<DamageNumber amount={2} onDone={onDone} />)
    act(() => {
      vi.advanceTimersByTime(699)
    })
    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

describe('DamageNumbers (store-driven)', () => {
  const TARGET = 'card:dmg-test-1'

  beforeEach(() => {
    vi.useFakeTimers()
    setSetting('effects', true)
  })

  afterEach(() => {
    vi.useRealTimers()
    setSetting('effects', true)
  })

  it('mounts a number when damage is spawned and removes it on animationend', () => {
    const view = render(<DamageNumbers targetKey={TARGET} />)
    expect(view.container.querySelector('.damage-number')).toBeNull()

    act(() => {
      spawnDamageNumber(TARGET, 3)
    })
    const number = view.container.querySelector('.damage-number')!
    expect(number.textContent).toBe('-3')

    fireEvent.animationEnd(number)
    expect(view.container.querySelector('.damage-number')).toBeNull()
  })

  it('removes the number after the backstop timer when the animation never ends', () => {
    const view = render(<DamageNumbers targetKey={TARGET} />)
    act(() => {
      spawnDamageNumber(TARGET, 5)
    })
    expect(view.container.querySelector('.damage-number')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(view.container.querySelector('.damage-number')).toBeNull()
  })

  it('keeps each target separate', () => {
    const view = render(<DamageNumbers targetKey={TARGET} />)
    act(() => {
      spawnDamageNumber('player:someone-else', 4)
    })
    expect(view.container.querySelector('.damage-number')).toBeNull()
  })

  it('records nothing when effects are off', () => {
    setSetting('effects', false)
    const view = render(<DamageNumbers targetKey={TARGET} />)
    act(() => {
      spawnDamageNumber(TARGET, 3)
    })
    expect(view.container.querySelector('.damage-number')).toBeNull()
  })

  it('ignores a zero amount', () => {
    const view = render(<DamageNumbers targetKey={TARGET} />)
    act(() => {
      spawnDamageNumber(TARGET, 0)
    })
    expect(view.container.querySelector('.damage-number')).toBeNull()
  })

  it('dismissing an unknown number is a no-op', () => {
    act(() => {
      spawnDamageNumber(TARGET, 1)
    })
    const view = render(<DamageNumbers targetKey={TARGET} />)
    expect(view.container.querySelectorAll('.damage-number')).toHaveLength(1)
    act(() => {
      dismissDamageNumber(TARGET, -1)
    })
    expect(view.container.querySelectorAll('.damage-number')).toHaveLength(1)
  })

  it('exposes the live list through the hook without an effects toggle', () => {
    expect(getState().settings.effects).toBe(true)
    const view = render(<Probe targetKey="card:hook-1" />)
    expect(view.container.textContent).toBe('0')
    act(() => {
      spawnDamageNumber('card:hook-1', 2)
    })
    expect(view.container.textContent).toBe('1')
  })
})

function Probe({ targetKey }: { targetKey: string }) {
  return <span>{useDamageNumbers(targetKey).length}</span>
}
