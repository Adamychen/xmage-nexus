// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { GameView } from '../net/types'
import LowLifeVignette from './LowLifeVignette'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

vi.mock('../audio/soundManager', () => ({ soundManager: { play: vi.fn() } }))

function gameAt(life: number): GameView {
  const me = makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, life })
  return makeGameView({ players: [me] }) as GameView
}

function renderAt(life: number) {
  return render(<LowLifeVignette game={gameAt(life)} />)
}

describe('LowLifeVignette thresholds (C3)', () => {
  afterEach(() => cleanup())

  it('renders nothing at life 6', () => {
    const { queryByTestId } = renderAt(6)
    expect(queryByTestId('low-life-vignette')).toBeNull()
  })

  it('renders the active vignette at life 5', () => {
    const { getByTestId } = renderAt(5)
    const vignette = getByTestId('low-life-vignette')
    expect(vignette.classList.contains('active')).toBe(true)
    expect(vignette.classList.contains('critical')).toBe(false)
  })

  it('renders the critical vignette at life 2', () => {
    const { getByTestId } = renderAt(2)
    const vignette = getByTestId('low-life-vignette')
    expect(vignette.classList.contains('active')).toBe(true)
    expect(vignette.classList.contains('critical')).toBe(true)
  })

  it('renders the critical vignette at life 1', () => {
    const { getByTestId } = renderAt(1)
    expect(getByTestId('low-life-vignette').classList.contains('critical')).toBe(true)
  })

  it('renders nothing without a game', () => {
    const { queryByTestId } = render(<LowLifeVignette game={null} />)
    expect(queryByTestId('low-life-vignette')).toBeNull()
  })
})
