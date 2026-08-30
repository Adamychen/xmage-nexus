import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import PlayerInfoBar from './PlayerInfoBar'
import type { PlayerView } from '../net/types'

import { makePlayer } from '../__fixtures__/gameViews'

const basePlayer: PlayerView = makePlayer({
  playerId: 'p1',
  name: 'Alice',
  life: 20,
  handCount: 7,
  libraryCount: 40,
  manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
  controlled: true,
  isHuman: true,
})

describe('PlayerInfoBar', () => {
  it('renders basic player info (avatar, name, life)', () => {
    const { container } = render(<PlayerInfoBar player={basePlayer} side="my" />)
    expect(container.querySelector('.player-name')?.textContent).toBe('Alice')
    expect(container.querySelector('.life-value')?.textContent).toBe('20')
  })

  it('renders Monarch badge and calls onHover with The Monarch token card', () => {
    const onHover = vi.fn()
    const monarchPlayer: PlayerView = {
      ...basePlayer,
      monarch: true,
    }
    const { container } = render(<PlayerInfoBar player={monarchPlayer} side="my" onHover={onHover} />)
    const badge = container.querySelector('.badge-monarch')
    expect(badge).toBeDefined()
    expect(badge?.querySelector('svg')).not.toBeNull()

    if (badge) {
      fireEvent.mouseEnter(badge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'The Monarch' }),
        expect.any(Object),
      )

      fireEvent.mouseLeave(badge)
      expect(onHover).toHaveBeenCalledWith(null)
    }
  })

  it('renders Initiative badge and triggers hover with The Initiative token card', () => {
    const onHover = vi.fn()
    const initPlayer: PlayerView = {
      ...basePlayer,
      initiative: true,
    }
    const { container } = render(<PlayerInfoBar player={initPlayer} side="my" onHover={onHover} />)
    const badge = container.querySelector('.badge-initiative')
    expect(badge).toBeDefined()
    expect(badge?.querySelector('svg')).not.toBeNull()

    if (badge) {
      fireEvent.mouseEnter(badge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'The Initiative' }),
        expect.any(Object),
      )
    }
  })

  it('detects The Ring from commandList, displays level and triggers hover', () => {
    const onHover = vi.fn()
    const ringPlayer: PlayerView = {
      ...basePlayer,
      commandList: [
        {
          id: 'ring-1',
          name: 'The Ring',
          rules: ['Your Ring-bearer is legendary...', 'Whenever your Ring-bearer attacks, draw then discard...'],
        },
      ],
    }
    const { container } = render(<PlayerInfoBar player={ringPlayer} side="my" onHover={onHover} />)
    const badge = container.querySelector('.badge-ring')
    expect(badge).toBeDefined()
    expect(badge?.querySelector('svg')).not.toBeNull()
    expect(badge?.textContent).toContain('2')

    if (badge) {
      fireEvent.mouseEnter(badge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'The Ring', displayName: 'The Ring (Nivel 2)' }),
        expect.any(Object),
      )
    }
  })

  it('detects active Dungeon from commandList and triggers hover', () => {
    const onHover = vi.fn()
    const dungeonPlayer: PlayerView = {
      ...basePlayer,
      commandList: [
        {
          id: 'dungeon-1',
          name: 'Undercity',
          cardTypes: ['Dungeon'],
        },
      ],
    }
    const { container } = render(<PlayerInfoBar player={dungeonPlayer} side="opp" onHover={onHover} />)
    const badge = container.querySelector('.badge-dungeon')
    expect(badge).toBeDefined()
    expect(badge?.querySelector('svg')).not.toBeNull()

    if (badge) {
      fireEvent.mouseEnter(badge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Undercity' }),
        expect.any(Object),
      )
    }
  })

  it('renders Citys Blessing and Speed with custom icons and token previews', () => {
    const onHover = vi.fn()
    const designatedPlayer: PlayerView = {
      ...basePlayer,
      designationNames: ["City's Blessing", 'Speed'],
    }
    const { container } = render(<PlayerInfoBar player={designatedPlayer} side="my" onHover={onHover} />)
    const badges = container.querySelectorAll('.badge-designation')
    expect(badges.length).toBe(2)
    expect(badges[0].textContent).toContain('🏛️')
    expect(badges[1].textContent).toContain('🏎️')

    fireEvent.mouseEnter(badges[0])
    expect(onHover).toHaveBeenCalledWith(
      expect.objectContaining({ name: "City's Blessing" }),
      expect.any(Object),
    )

    fireEvent.mouseEnter(badges[1])
    expect(onHover).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Speed' }),
      expect.any(Object),
    )
  })

  it('renders Day/Night designation badge and triggers hover', () => {
    const onHover = vi.fn()
    const dayPlayer: PlayerView = {
      ...basePlayer,
      designationNames: ['Day'],
    }
    const { container } = render(<PlayerInfoBar player={dayPlayer} side="my" onHover={onHover} />)
    const badge = container.querySelector('.badge-daynight')
    expect(badge).toBeDefined()
    expect(badge?.querySelector('svg')).not.toBeNull()

    if (badge) {
      fireEvent.mouseEnter(badge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Day // Night' }),
        expect.any(Object),
      )
    }
  })

  it('renders player counters and triggers token preview on hover', () => {
    const onHover = vi.fn()
    const counterPlayer: PlayerView = {
      ...basePlayer,
      counters: [
        { name: 'Poison', count: 4 },
        { name: 'Energy', count: 3 },
      ],
    }
    const { container } = render(<PlayerInfoBar player={counterPlayer} side="my" onHover={onHover} />)
    const poisonBadge = container.querySelector('.counter-poison')
    expect(poisonBadge).toBeDefined()
    expect(poisonBadge?.textContent).toContain('4')

    if (poisonBadge) {
      fireEvent.mouseEnter(poisonBadge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Poison Counter' }),
        expect.any(Object),
      )
    }
  })

  it('renders priority timer badge when priorityTimeLeftSecs > 0', () => {
    const timedPlayer: PlayerView = {
      ...basePlayer,
      hasPriority: true,
      priorityTimeLeftSecs: 95,
    }
    const { container } = render(<PlayerInfoBar player={timedPlayer} side="my" />)
    const timerBadge = container.querySelector('.player-timer-badge')
    expect(timerBadge).toBeDefined()
    expect(timerBadge?.classList.contains('timer-active')).toBe(true)
    expect(timerBadge?.querySelector('.timer-value')?.textContent).toBe('01:35')
  })

  it('marks timer low when timeLeft <= 30', () => {
    const lowTimePlayer: PlayerView = {
      ...basePlayer,
      priorityTimeLeftSecs: 20,
    }
    const { container } = render(<PlayerInfoBar player={lowTimePlayer} side="my" />)
    const timerBadge = container.querySelector('.player-timer-badge')
    expect(timerBadge?.classList.contains('timer-low')).toBe(true)
  })

  it('renders buffer time when bufferTimeLeft > 0', () => {
    const bufferPlayer: PlayerView = {
      ...basePlayer,
      hasPriority: true,
      priorityTimeLeftSecs: 90,
      bufferTimeLeft: 30,
    }
    const { container } = render(<PlayerInfoBar player={bufferPlayer} side="my" />)
    const buf = container.querySelector('.timer-buffer')
    expect(buf).not.toBeNull()
    expect(buf?.textContent).toContain('00:30')
  })

  it('renders Curses badge when player has attachments', () => {
    const onHover = vi.fn()
    const cursePlayer: PlayerView = {
      ...basePlayer,
      attachments: ['curse-1', 'curse-2'],
    }
    const { container } = render(<PlayerInfoBar player={cursePlayer} side="my" onHover={onHover} />)
    const badge = container.querySelector('.badge-curse')
    expect(badge).toBeDefined()
    expect(badge?.querySelector('svg')).not.toBeNull()
    expect(badge?.textContent).toContain('2')

    if (badge) {
      fireEvent.mouseEnter(badge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Maldición (2)' }),
        expect.any(Object),
      )
    }
  })
})
