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
    settings: { ...initialState.settings, gameUi: 'v1' },
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
    expect(container.querySelector('[data-testid="game-board"]')).not.toBeNull()
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
      settings: { ...initialState.settings, gameUi: 'v1', boardLayout: 'arena', boardSpotlight: true },
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
      settings: { ...initialState.settings, gameUi: 'v1', boardLayout: 'arena', boardSpotlight: true },
    })
    expect(container.querySelector('[data-testid="spotlight-board"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="spotlight-main"]')?.getAttribute('data-main-seat')).toBe('p4')
    expect(container.querySelector('[data-testid="hand-bar"]')).toBeNull()
  })

  it('BRD-6: with the switch off the opponents\' row stays', () => {
    const { container } = show({
      game: fourPlayerArena(),
      myPlayerId: 'p1',
      settings: { ...initialState.settings, gameUi: 'v1', boardLayout: 'arena', boardSpotlight: false },
    })
    expect(container.querySelector('[data-testid="spotlight-board"]')).toBeNull()
    expect(container.querySelector('.arena-opp-row')).not.toBeNull()
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

  it('glows the v2 top-bar turn number when the turn changes', async () => {
    const { container } = show({ settings: { ...initialState.settings, gameUi: 'v2' } })
    const turn = container.querySelector<HTMLElement>('.game-topbar-turn-num')!
    expect(turn.classList.contains('turn-glow')).toBe(false)

    await act(async () => {
      setState({ game: { ...playerGameView, turn: 2 } } as never)
    })
    expect(turn.classList.contains('turn-glow')).toBe(true)
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
