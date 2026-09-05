import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OpponentSwitcherBar from './OpponentSwitcherBar'
import type { PlayerView } from '../net/types'

describe('OpponentSwitcherBar', () => {
  afterEach(() => {
    cleanup()
  })

  const mockOpponents = [    {
      playerId: 'p2',
      name: 'Alice',
      life: 40,
      controlled: false,
    },
    {
      playerId: 'p3',
      name: 'Bob',
      life: 38,
      controlled: false,
    },
    {
      playerId: 'p4',
      name: 'Charlie',
      life: 32,
      controlled: false,
    },
  ] as unknown as PlayerView[]

  it('renders nothing when only 1 opponent', () => {
    const { container } = render(
      <OpponentSwitcherBar
        players={[mockOpponents[0]]}
        selectedOppId="p2"
        onSelectOpponent={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing in 1v1 (only me + one rival focusable)', () => {
    const { container } = render(
      <OpponentSwitcherBar
        players={[
          { playerId: 'p1', name: 'Me', life: 20, controlled: true } as unknown as PlayerView,
          mockOpponents[0],
        ]}
        controlledId="p1"
        selectedOppId="p2"
        onSelectOpponent={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders pills for all opponents with life totals', () => {
    const onSelect = vi.fn()
    render(
      <OpponentSwitcherBar
        players={mockOpponents}
        selectedOppId="p2"
        onSelectOpponent={onSelect}
        activePlayerId="p2"
      />
    )

    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('Charlie')).toBeDefined()
    expect(screen.getByText('TURNO')).toBeDefined()

    fireEvent.click(screen.getByText('Bob'))
    expect(onSelect).toHaveBeenCalledWith('p3')
  })

  it('cycles with chevron buttons', () => {
    const onSelect = vi.fn()
    render(
      <OpponentSwitcherBar
        players={mockOpponents}
        selectedOppId="p2"
        onSelectOpponent={onSelect}
      />
    )

    const nextBtn = screen.getByTitle('Ver oponente siguiente')
    fireEvent.click(nextBtn)
    expect(onSelect).toHaveBeenCalledWith('p4')

    const prevBtn = screen.getByTitle('Ver oponente anterior')
    fireEvent.click(prevBtn)
    expect(onSelect).toHaveBeenCalledWith('p3')
  })

  it('shows my pill deactivated in turn order with arrows between pills', () => {
    const onSelect = vi.fn()
    const players = [
      { playerId: 'p1', name: 'Me', life: 20, controlled: true },
      ...mockOpponents,
    ] as unknown as PlayerView[]
    const { container } = render(
      <OpponentSwitcherBar
        players={players}
        controlledId="p1"
        selectedOppId="p2"
        onSelectOpponent={onSelect}
        activePlayerId="p2"
      />
    )

    const pills = Array.from(container.querySelectorAll('.opp-pill')).map((el) => el.textContent)
    expect(pills.length).toBe(4)
    expect(container.querySelector('.opp-pill.is-self')?.textContent).toContain('Me')

    const arrows = container.querySelectorAll('.opp-arrow')
    expect(arrows.length).toBe(4)
    // orden mostrado invertido (orden real de turnos): p4 → p3 → p2 → p1 ↺
    expect(container.querySelector('[data-testid="opp-arrow-p2-p1"]')?.classList.contains('is-active-edge')).toBe(true)
    expect(container.querySelector('[data-testid="opp-arrow-p3-p2"]')?.classList.contains('is-active-edge')).toBe(false)
    expect(container.querySelector('[data-testid="opp-arrow-p1-p4"]')?.textContent).toContain('↺')

    fireEvent.click(screen.getByText('Me'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('cycle skips me and defeated players', () => {
    const onSelect = vi.fn()
    const players = [
      { playerId: 'p1', name: 'Me', life: 20, controlled: true },
      mockOpponents[0],
      { ...mockOpponents[1], life: 0 },
      mockOpponents[2],
    ] as unknown as PlayerView[]
    render(
      <OpponentSwitcherBar
        players={players}
        controlledId="p1"
        selectedOppId="p2"
        onSelectOpponent={onSelect}
      />
    )

    fireEvent.click(screen.getByTitle('Ver oponente siguiente'))
    expect(onSelect).toHaveBeenCalledWith('p4')
  })
})
