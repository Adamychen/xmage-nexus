import { beforeEach, describe, it, expect, vi } from 'vitest'
import { setSetting } from '../state/store'
import { act, render, fireEvent } from '@testing-library/react'
import PlayerInfoBar from './PlayerInfoBar'
import type { PlayerView } from '../net/types'
import { setState } from '../state/store'

import { makePermanent, makePlayer, playerGameView } from '../__fixtures__/gameViews'

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
  beforeEach(() => setSetting('gameUi', 'v1'))

  it('renders basic player info (avatar, name, life)', () => {
    const { container } = render(<PlayerInfoBar player={basePlayer} side="my" />)
    expect(container.querySelector('.player-name')?.textContent).toBe('Alice')
    expect(container.querySelector('.life-value')?.textContent).toBe('20')
  })

  it('shows the rank badge from the userData ratings the server sends', () => {
    const withRating: PlayerView = {
      ...basePlayer,
      userData: { generalRating: 1620, constructedRating: 1620, limitedRating: 1500 },
    }
    const { container } = render(<PlayerInfoBar player={withRating} side="my" />)
    const badge = container.querySelector('.rank-badge')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toContain('1620')
  })

  it('draws no rank badge without userData, and none for non-human seats', () => {
    const { container: plain } = render(<PlayerInfoBar player={basePlayer} side="my" />)
    expect(plain.querySelector('.rank-badge')).toBeNull()
    const bot: PlayerView = {
      ...basePlayer,
      isHuman: false,
      userData: { generalRating: 1750, constructedRating: 1750 },
    }
    const { container: botBar } = render(<PlayerInfoBar player={bot} side="opp" />)
    expect(botBar.querySelector('.rank-badge')).toBeNull()
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
        expect.objectContaining({ name: 'The Ring', displayName: expect.stringContaining('Nivel 2') }),
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

  it('shows the sniffed speed level on the Speed badge', () => {
    const speedy: PlayerView = {
      ...basePlayer,
      name: 'Alice',
      designationNames: ['Speed'],
    }
    setState({ gameId: 'g-speed', speedLevels: { 'g-speed‖alice': 3 } })
    const { container } = render(<PlayerInfoBar player={speedy} side="my" />)
    const badges = container.querySelectorAll('.badge-designation')
    expect(badges.length).toBe(1)
    expect(badges[0].querySelector('.badge-sub-level')?.textContent).toBe('3')
    expect(badges[0].getAttribute('title')).toContain('3')
    setState({ gameId: 'g-speed', speedLevels: {} })
    const { container: plain } = render(<PlayerInfoBar player={speedy} side="my" />)
    expect(plain.querySelector('.badge-sub-level')).toBeNull()
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
    expect(badges[0].querySelector('svg')).not.toBeNull()
    expect(badges[1].querySelector('svg')).not.toBeNull()

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

  it('renders Day/Night badge from the real rules hint and triggers hover', () => {
    const onHover = vi.fn()
    const dayPlayer: PlayerView = {
      ...basePlayer,
      battlefield: {
        perm1: makePermanent({
          name: 'Reckless Stormseeker',
          parentId: 'perm1',
          rules: [
            'Daybound <i>(If a player casts no spells during their own turn, it becomes night next turn.)</i>',
            '<br/><hintstart/>',
            "It's currently day, active player has cast 1 spells this turn. It will not become night next turn.",
          ],
        }),
      },
    }
    const { container } = render(<PlayerInfoBar player={dayPlayer} side="my" onHover={onHover} />)
    const badge = container.querySelector('.badge-daynight')
    expect(badge).toBeDefined()
    expect(badge?.querySelector('svg')).not.toBeNull()
    expect(badge?.classList.contains('is-day')).toBe(true)

    if (badge) {
      fireEvent.mouseEnter(badge)
      expect(onHover).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Day // Night',
          rules: ["It's currently day, active player has cast 1 spells this turn. It will not become night next turn."],
        }),
        expect.any(Object),
      )
    }
  })

  it('ignores Day/Night designationNames without a real day/night hint', () => {
    const stalePlayer: PlayerView = {
      ...basePlayer,
      designationNames: ['Night', 'Day'],
    }
    const { container } = render(<PlayerInfoBar player={stalePlayer} side="my" />)
    expect(container.querySelector('.badge-daynight')).toBeNull()
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

  it('marks the timer critical at 5 seconds', () => {
    const { container } = render(<PlayerInfoBar player={{ ...basePlayer, priorityTimeLeftSecs: 5 }} side="my" />)
    const timerBadge = container.querySelector('.player-timer-badge')
    expect(timerBadge?.classList.contains('critical')).toBe(true)
    expect(timerBadge?.classList.contains('urgent')).toBe(false)
    expect(timerBadge?.classList.contains('warn')).toBe(false)
  })

  it('marks the timer urgent at 10 seconds and warn at 30', () => {
    const { container: urgent } = render(<PlayerInfoBar player={{ ...basePlayer, priorityTimeLeftSecs: 10 }} side="my" />)
    expect(urgent.querySelector('.player-timer-badge')?.classList.contains('urgent')).toBe(true)
    const { container: warn } = render(<PlayerInfoBar player={{ ...basePlayer, priorityTimeLeftSecs: 30 }} side="my" />)
    expect(warn.querySelector('.player-timer-badge')?.classList.contains('warn')).toBe(true)
  })

  it('glows only when this player becomes the active turn', () => {
    setState({ game: { ...playerGameView, activePlayerId: 'p1' } } as never)
    const opp = { ...basePlayer, playerId: 'p2', name: 'Bob', controlled: false }
    const { container, rerender } = render(<PlayerInfoBar player={opp} side="opp" />)
    const bar = container.querySelector('.player-info-bar')!
    expect(bar.classList.contains('active-glow')).toBe(false)

    act(() => {
      setState({ game: { ...playerGameView, activePlayerId: 'p2' } } as never)
    })
    rerender(<PlayerInfoBar player={opp} side="opp" />)
    expect(bar.classList.contains('active-glow')).toBe(true)

    fireEvent.animationEnd(bar)
    expect(bar.classList.contains('active-glow')).toBe(false)

    act(() => {
      setState({ game: { ...playerGameView, activePlayerId: 'p1', life: 19 } } as never)
    })
    rerender(<PlayerInfoBar player={opp} side="opp" />)
    expect(bar.classList.contains('active-glow')).toBe(false)
    setState({ game: null } as never)
  })

  it('hides the timer badge when the server sends no time limit (Integer.MAX_VALUE)', () => {
    const timelessPlayer: PlayerView = {
      ...basePlayer,
      hasPriority: true,
      timerActive: true,
      priorityTimeLeftSecs: 2147483647,
    }
    const { container } = render(<PlayerInfoBar player={timelessPlayer} side="my" />)
    expect(container.querySelector('.player-timer-badge')).toBeNull()
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

  it('renders Curses badge when player has attachments', () => {    const onHover = vi.fn()
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

  it('marks the active player with turn glow only (no badge)', () => {
    const activePlayer: PlayerView = { ...basePlayer, isActive: true }
    const { container } = render(<PlayerInfoBar player={activePlayer} side="my" />)
    expect(container.querySelector('.player-info-bar.is-turn')).not.toBeNull()
    expect(container.querySelector('.player-status-badge.status-turn')).toBeNull()
  })

  it('shows no turn mark on the inactive player', () => {
    const { container } = render(<PlayerInfoBar player={basePlayer} side="opp" />)
    expect(container.querySelector('.player-info-bar.is-turn')).toBeNull()
    expect(container.querySelector('.player-status-badge.status-turn')).toBeNull()
  })

  it('hides the turn mark on defeated players even if active', () => {
    const deadActive: PlayerView = { ...basePlayer, isActive: true, life: 0, hasLeft: true }
    const { container } = render(<PlayerInfoBar player={deadActive} side="my" />)
    expect(container.querySelector('.player-info-bar.is-turn')).toBeNull()
    expect(container.querySelector('.player-status-badge.status-turn')).toBeNull()
    expect(container.querySelector('.player-status-badge.status-defeated')).not.toBeNull()
  })

  it('keeps turn mark and life on a player at 0 life who is still in the game', () => {
    const cantLose: PlayerView = { ...basePlayer, isActive: true, life: -1 }
    const { container } = render(<PlayerInfoBar player={cantLose} side="my" />)
    expect(container.querySelector('.player-info-bar.is-turn')).not.toBeNull()
    expect(container.querySelector('.player-status-badge.status-defeated')).toBeNull()
    expect(container.querySelector('.player-status-badge.status-left')).toBeNull()
  })

  it('marks a player who left with life above 0 as left', () => {
    const leaver: PlayerView = { ...basePlayer, hasLeft: true }
    const { container } = render(<PlayerInfoBar player={leaver} side="my" />)
    expect(container.querySelector('.player-status-badge.status-left')).not.toBeNull()
    expect(container.querySelector('.player-status-badge.status-defeated')).toBeNull()
  })
})
