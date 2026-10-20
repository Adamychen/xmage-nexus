import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerInfoBar from './PlayerInfoBar'
import { setSetting } from '../state/store'
import { setState } from '../state/state'
import { COUNTER_PULSE_MS } from '../board/useCounterPulse'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { PlayerView } from '../net/types'

const base = makePlayer({ playerId: 'o', name: 'Bob', life: 20, counters: [] })
const withCounters = (counters: PlayerView['counters']) => ({ ...base, counters })

function badge(container: HTMLElement, kind: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`.player-counter-badge[data-counter="${kind}"]`)
}

describe('PlayerInfoBar player counters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setSetting('gameUi', 'v1')
    setState({ game: makeGameView({ players: [base] }) })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    setState({ game: null })
  })

  it('the first poison counter appears pulsing, with a ring and a ticking number', () => {
    const view = render(<PlayerInfoBar player={base} side="opp" />)
    expect(badge(view.container, 'poison')).toBeNull()
    view.rerender(<PlayerInfoBar player={withCounters([{ name: 'poison', count: 1 }])} side="opp" />)
    const poison = badge(view.container, 'poison')
    expect(poison?.className).toContain('counter-badge-changed')
    expect(poison?.className).toContain('counter-badge-up')
    expect(poison?.querySelector('.counter-change-ring')).not.toBeNull()
    expect(poison?.querySelector('.counter-val')?.className).toContain('counter-tick')
    act(() => {
      vi.advanceTimersByTime(COUNTER_PULSE_MS + 20)
    })
    expect(badge(view.container, 'poison')?.className).not.toContain('counter-badge-changed')
  })

  it('a count that drops pulses down; a counter that does not change stays still', () => {
    const view = render(<PlayerInfoBar player={withCounters([{ name: 'energy', count: 4 }, { name: 'experience', count: 1 }])} side="opp" />)
    view.rerender(<PlayerInfoBar player={withCounters([{ name: 'energy', count: 1 }, { name: 'experience', count: 1 }])} side="opp" />)
    expect(badge(view.container, 'energy')?.className).toContain('counter-badge-down')
    expect(badge(view.container, 'experience')?.className).not.toContain('counter-badge-changed')
  })

  it('ten poison counters keep the badge glowing', () => {
    const view = render(<PlayerInfoBar player={withCounters([{ name: 'poison', count: 10 }])} side="opp" />)
    expect(badge(view.container, 'poison')?.className).toContain('is-lethal')
  })
})
