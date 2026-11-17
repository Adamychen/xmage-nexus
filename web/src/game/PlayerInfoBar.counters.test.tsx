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

describe('BRD-53: the symbol of a player counter', () => {
  afterEach(() => {
    cleanup()
    setState({ game: null })
  })

  const art = (container: HTMLElement, kind: string): string =>
    badge(container, kind)?.querySelector<HTMLElement>('.counter-art')?.style.getPropertyValue('--counter-art') ?? ''

  it('BRD-53: poison, energy, experience, rad, ticket and acorn carry the symbol of the game', () => {
    const counters = [
      { name: 'poison', count: 3 },
      { name: 'energy', count: 2 },
      { name: 'experience', count: 1 },
      { name: 'rad', count: 4 },
      { name: 'ticket', count: 5 },
      { name: 'acorn', count: 6 },
    ]
    setState({ game: makeGameView({ players: [withCounters(counters)] }) })
    const { container } = render(<PlayerInfoBar player={withCounters(counters)} side="opp" />)
    for (const { name } of counters) {
      expect(art(container, name), `${name} draws its own symbol`).toContain(`symbols/counters/${name}.svg`)
    }
  })

  it('BRD-53: a counter the game has no symbol for keeps a glyph', () => {
    const counters = [{ name: 'blood', count: 2 }]
    setState({ game: makeGameView({ players: [withCounters(counters)] }) })
    const { container } = render(<PlayerInfoBar player={withCounters(counters)} side="opp" />)
    expect(badge(container, 'blood')?.querySelector('.counter-art')).toBeNull()
    expect(badge(container, 'blood')?.querySelector('svg')).not.toBeNull()
    expect(badge(container, 'blood')?.getAttribute('title')).toBe('Blood: 2')
  })
})

describe('BRD-54: the stack of counters beside the chip', () => {
  afterEach(() => {
    cleanup()
    setState({ game: null })
  })

  it('BRD-54: the stack says how many counters a column holds, and never fewer than one', () => {
    const counters = [{ name: 'poison', count: 1 }, { name: 'energy', count: 2 }, { name: 'rad', count: 3 }]
    const player = { ...withCounters(counters), controlled: true }
    setState({ game: makeGameView({ players: [player] }) })
    const { container } = render(<PlayerInfoBar player={player} side="my" bare />)
    const stack = container.querySelector<HTMLElement>('[data-testid="bare-counters"]')
    expect(stack).not.toBeNull()
    expect(Number(stack!.style.getPropertyValue('--counter-rows'))).toBeGreaterThanOrEqual(1)
    // No plate of its own: the colour and the spacing are what separate one counter from the next.
    const badge = stack!.querySelector<HTMLElement>('.player-counter-badge')!
    expect(badge.className).toContain('counter-poison')
  })
})
