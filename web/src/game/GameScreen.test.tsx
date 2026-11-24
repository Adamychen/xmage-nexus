import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GameScreen from './GameScreen'
import { initialState, setState } from '../state/state'
import { makePlayer, playerGameView, spectatorGameView } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

function show(extra: Record<string, unknown> = {}) {
  setState({
    ...initialState,
    settings: { ...initialState.settings },
    conn: { serverHost: 'localhost', port: 17171, username: 'tester', wsHost: 'localhost', proxyPort: 8787 },
    gameId: 'game-1',
    game: playerGameView,
    myPlayerId: playerGameView.myPlayerId,
    ...extra,
  } as never)
  return render(<GameScreen />)
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setState({ ...initialState } as never)
})

describe('GameScreen', () => {
  it('paints the board for a player view without throwing', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = show()
    expect(container.querySelector('.game')).not.toBeNull()
    expect(container.querySelector('.arena-board')).not.toBeNull()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('renders a spectator view', () => {
    const { container } = show({ game: spectatorGameView, myPlayerId: null })
    expect(container.querySelector('.game')).not.toBeNull()
  })

  it('renders nothing playable without a game and does not crash', () => {
    expect(() => show({ game: null })).not.toThrow()
  })

  function fourPlayerArena(): GameView {
    return {
      ...playerGameView,
      activePlayerId: 'p1',
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, life: 40, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', life: 40, commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', life: 40, commandList: [] }),
        makePlayer({ playerId: 'p4', name: 'Dave', life: 40, commandList: [] }),
      ],
    }
  }

  it('BRD-6: the switch on with two live opponents draws the main board instead of the opponents\' row', () => {
    const { container } = show({
      game: fourPlayerArena(),
      myPlayerId: 'p1',
      settings: { ...initialState.settings, boardSpotlight: true },
    })
    expect(container.querySelector('[data-testid="spotlight-board"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="spotlight-panel"]')).not.toBeNull()
    expect(container.querySelector('.arena-opp-row')).toBeNull()
  })

  it('BRD-6: a spectator with the switch on watching four players gets the main board', () => {
    const watched = {
      ...fourPlayerArena(),
      myPlayerId: null,
      players: fourPlayerArena().players!.map((p) => ({ ...p, controlled: false })),
    } as GameView
    const { container } = show({
      game: watched,
      myPlayerId: null,
      settings: { ...initialState.settings, boardSpotlight: true },
    })
    expect(container.querySelector('[data-testid="spotlight-board"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="spotlight-main"]')?.getAttribute('data-main-seat')).toBe('p4')
    expect(container.querySelector('[data-testid="hand-bar"]')).toBeNull()
  })

  function duel(): GameView {
    return { ...fourPlayerArena(), players: fourPlayerArena().players!.slice(0, 2) }
  }

  const spotlightSettings = (boardSpotlight = true) =>
    ({ ...initialState.settings, boardSpotlight }) as typeof initialState.settings

  it('BRD-6: in a duel the switch on keeps the main board with the opponent in the panel', () => {
    const { container } = show({ game: duel(), myPlayerId: 'p1', settings: spotlightSettings() })
    expect(container.querySelector('[data-testid="spotlight-main"]')?.getAttribute('data-main-seat')).toBe('p1')
    expect(container.querySelector('[data-testid="spotlight-copy-p2"]')).not.toBeNull()
  })

  it('BRD-6: a duel with the switch off is drawn on the Arena board, its opponent in one column', () => {
    const { container } = show({ game: duel(), myPlayerId: 'p1', settings: { ...initialState.settings, boardSpotlight: false } })
    expect(container.querySelector('[data-testid="spotlight-board"]')).toBeNull()
    expect(container.querySelector('[data-testid="game-board"]')).toBeNull()
    expect(container.querySelector('.arena-board')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid^="arena-opp-cell-"]')).toHaveLength(1)
  })

  it('BRD-6: six players with the switch off get the main board and every opponent in the panel', () => {
    const six = { ...fourPlayerArena(), players: [...fourPlayerArena().players!, makePlayer({ playerId: 'p5', name: 'Eve', life: 40, commandList: [] }), makePlayer({ playerId: 'p6', name: 'Finn', life: 40, commandList: [] })] }
    const { container } = show({ game: six, myPlayerId: 'p1', settings: { ...initialState.settings, boardSpotlight: false } })
    expect(container.querySelector('[data-testid="spotlight-board"]')).not.toBeNull()
    for (const id of ['p2', 'p3', 'p4', 'p5', 'p6']) expect(container.querySelector(`[data-testid="spotlight-copy-${id}"]`)).not.toBeNull()
  })

  it('BRD-6: a spectator watching a duel with the switch on gets the main board', () => {
    const watched = { ...duel(), myPlayerId: null, players: duel().players!.map((p) => ({ ...p, controlled: false })) } as GameView
    const { container } = show({ game: watched, myPlayerId: null, settings: spotlightSettings() })
    expect(container.querySelector('[data-testid="spotlight-main"]')?.getAttribute('data-main-seat')).toBe('p2')
    expect(container.querySelector('[data-testid="spotlight-copy-p1"]')).not.toBeNull()
  })

  it('BRD-6: when two players are left in a pod the main board stays, with the live opponent as a copy and the others folded', () => {
    const game = fourPlayerArena()
    const twoLeft = { ...game, players: game.players!.map((p) => (p.playerId === 'p3' || p.playerId === 'p4' ? { ...p, hasLeft: true, life: 0 } : p)) }
    const { container } = show({ game: twoLeft, myPlayerId: 'p1', settings: spotlightSettings() })
    expect(container.querySelector('[data-testid="spotlight-copy-p2"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="spotlight-copy-p3"]')).toBeNull()
    expect(container.querySelector('[data-testid="spotlight-copy-p4"]')).toBeNull()
    expect(container.querySelector('[data-testid="spotlight-head-p3"]')?.classList.contains('is-out')).toBe(true)
    expect(container.querySelector('[data-testid="spotlight-head-p4"]')?.classList.contains('is-out')).toBe(true)
  })

  it('BRD-6: with the switch off the opponents\' row stays', () => {
    const { container } = show({
      game: fourPlayerArena(),
      myPlayerId: 'p1',
      settings: { ...initialState.settings, boardSpotlight: false },
    })
    expect(container.querySelector('[data-testid="spotlight-board"]')).toBeNull()
    expect(container.querySelector('.arena-opp-row')).not.toBeNull()
  })

  it('BRD-32: the game screen has the one Arena chrome', () => {
    const { container } = show()
    expect(container.querySelector('.game--v2')).toBeNull()
    expect(container.querySelector('.game-top--v2')).toBeNull()
    expect(container.querySelector('[data-testid="side-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="phase-dial"]')).toBeNull()
    expect(container.querySelector('[data-testid="game-strip"]')).not.toBeNull()
  })

  it('PNL-10: opening the chat and log panel never resizes the board', async () => {
    const { container, getByTestId, queryByTestId } = show()
    const wrap = container.querySelector<HTMLElement>('.board-wrap')!
    const before = { cls: wrap.className, style: wrap.getAttribute('style') }
    await act(async () => { getByTestId('chatlog-toggle-log').click() })
    expect(getByTestId('chatlog-panel').getAttribute('data-tab')).toBe('log')
    expect(wrap.className).toBe(before.cls)
    expect(wrap.getAttribute('style')).toBe(before.style)
    expect(queryByTestId('drawer-tab-tracker')).toBeNull()
    expect(queryByTestId('drawer-tab-log')).toBeNull()
    expect(queryByTestId('drawer-tab-chat')).toBeNull()
  })

  it('HND-7: the hand column gives way to the fan while the chat and log panel is open', async () => {
    const { container, getByTestId } = show({ settings: { ...initialState.settings, handRail: true } })
    expect(container.querySelector('.has-hand-rail')).not.toBeNull()
    await act(async () => { getByTestId('chatlog-toggle-chat').click() })
    expect(container.querySelector('.has-hand-rail')).toBeNull()
    await act(async () => { getByTestId('chatlog-toggle-chat').click() })
    expect(container.querySelector('.has-hand-rail')).not.toBeNull()
  })

  it('applies the inverse of the UI scale so the board is not zoomed twice', () => {
    const { container } = show({ settings: { ...initialState.settings, uiScale: 1.3 } })
    const root = container.querySelector<HTMLElement>('.game')!
    expect(parseFloat(root.style.zoom)).toBeCloseTo(1 / 1.3, 2)
  })

  it('adds turn-glow only when the turn number changes', async () => {
    const { container } = show()
    const turn = container.querySelector<HTMLElement>('.game-turn')!
    expect(turn.classList.contains('turn-glow')).toBe(false)

    await act(async () => {
      setState({ game: { ...playerGameView, turn: 2 } } as never)
    })
    expect(turn.classList.contains('turn-glow')).toBe(true)

    await act(async () => {
      turn.dispatchEvent(new Event('animationend', { bubbles: true }))
    })
    expect(turn.classList.contains('turn-glow')).toBe(false)

    await act(async () => {
      setState({ game: { ...playerGameView, turn: 2, life: 19 } } as never)
    })
    expect(turn.classList.contains('turn-glow')).toBe(false)
  })

  it('survives a stream of view updates', async () => {
    show()
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        setState({ game: { ...playerGameView, turn: i + 1 } } as never)
      })
    }
    expect(document.querySelector('.game')).not.toBeNull()
  })
})
