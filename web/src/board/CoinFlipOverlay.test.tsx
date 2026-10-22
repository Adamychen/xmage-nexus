import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act, screen } from '@testing-library/react'
import CoinFlipOverlay from './CoinFlipOverlay'
import { startCoinFlip, clearCoinFlipFx, COIN_FLIP_MS } from './coinFlipFx'
import { soundManager } from '../audio/soundManager'
import { setState } from '../state/store'

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }))
}

describe('CoinFlipOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    stubReducedMotion(false)
  })

  afterEach(() => {
    cleanup()
    clearCoinFlipFx()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nothing until a flip starts', () => {
    const { container } = render(<CoinFlipOverlay />)
    expect(container.querySelector('.coin-flip-coin')).toBeNull()
  })

  it('shows the first player on the front face and spins when motion is allowed', () => {
    const { container } = render(<CoinFlipOverlay />)
    act(() => {
      startCoinFlip('Bob', 'var(--seat-1)')
    })
    expect(screen.getByText('Bob')).toBeTruthy()
    const coin = container.querySelector('.coin-flip-coin')
    expect(coin?.classList.contains('is-spin')).toBe(true)
    expect(container.querySelector('.coin-flip-overlay')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('removes itself after the duration', () => {
    const { container } = render(<CoinFlipOverlay />)
    act(() => {
      startCoinFlip('Bob', 'var(--seat-1)')
    })
    act(() => {
      vi.advanceTimersByTime(COIN_FLIP_MS - 10)
    })
    expect(container.querySelector('.coin-flip-coin')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(container.querySelector('.coin-flip-coin')).toBeNull()
  })

  it('FX-2: does not spin under reduced motion: it only fades', () => {
    stubReducedMotion(true)
    const { container } = render(<CoinFlipOverlay />)
    act(() => {
      startCoinFlip('Alice', 'var(--seat-0)')
    })
    const coin = container.querySelector('.coin-flip-coin')
    expect(coin?.classList.contains('is-fade')).toBe(true)
    expect(coin?.classList.contains('is-spin')).toBe(false)
    expect(screen.getByText('Alice')).toBeTruthy()
  })

  it('DLG-7: steps aside for a blocking dialog and does not come back when it closes', () => {
    const { container } = render(<CoinFlipOverlay />)
    act(() => { startCoinFlip('Alice', 'var(--seat-0)') })
    expect(container.querySelector('.coin-flip-coin')).not.toBeNull()
    act(() => { setState({ inspectedCard: { id: 'c-1' } as never }) })
    expect(container.querySelector('.coin-flip-coin')).toBeNull()
    act(() => { setState({ inspectedCard: null }) })
    expect(container.querySelector('.coin-flip-coin')).toBeNull()
  })
})
