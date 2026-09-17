// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SideboardScreen from './SideboardScreen'
import { reset } from '../state/store'
import { setState } from '../state/state'
import type { SideboardScreenState } from '../state/state'
import { submitDeck } from '../net/commands'

vi.mock('../net/commands', () => ({
  submitDeck: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../cards/cardImages', () => ({
  awaitCardMeta: vi.fn().mockResolvedValue({ name: 'Test Card', typeLine: 'Creature', manaCost: '{1}{G}', imageUrl: 'https://img.test/card.jpg' }),
}))

function makeScreen(overrides: Partial<SideboardScreenState> = {}): SideboardScreenState {
  return {
    deckName: 'Test Deck',
    maindeck: [
      { instanceId: 'i-1', setCode: 'IMA', cardNumber: '165', name: 'Grizzly Bears' },
      { instanceId: 'i-2', setCode: 'M10', cardNumber: '147', name: 'Lightning Bolt' },
      { instanceId: 'i-3', setCode: 'M21', cardNumber: '237', name: 'Island' },
    ],
    sideboard: [
      { instanceId: 'i-4', setCode: 'M21', cardNumber: '59', name: 'Negate' },
    ],
    tableId: 'table-1',
    parentTableId: null,
    timeLeft: 180,
    limited: false,
    ...overrides,
  }
}

describe('SideboardScreen', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    reset()
  })

  it('does not render when sideboardScreen is null', () => {
    const { container } = render(<SideboardScreen />)
    expect(container.querySelector('.sideboard-backdrop')).toBeNull()
  })

  it('renders when sideboardScreen is set', () => {
    setState({ sideboardScreen: makeScreen() })
    const { container } = render(<SideboardScreen />)
    expect(container.querySelector('.sideboard-backdrop')).toBeTruthy()
    expect(container.textContent).toContain('Test Deck')
  })

  it('shows card names in maindeck and sideboard columns', () => {
    setState({ sideboardScreen: makeScreen() })
    const { container } = render(<SideboardScreen />)
    expect(container.textContent).toContain('Grizzly Bears')
    expect(container.textContent).toContain('Lightning Bolt')
    expect(container.textContent).toContain('Island')
    expect(container.textContent).toContain('Negate')
  })

  it('shows timer', () => {
    setState({ sideboardScreen: makeScreen({ timeLeft: 120 }) })
    const { container } = render(<SideboardScreen />)
    expect(container.textContent).toContain('2:00')
  })

  it('submit button is present', () => {
    setState({ sideboardScreen: makeScreen() })
    const { container } = render(<SideboardScreen />)
    expect(container.textContent).toContain('Enviar mazo')
  })

  it('shows filter when more than 10 cards in maindeck', () => {
    const maindeck = Array.from({ length: 12 }, (_, i) => ({
      instanceId: `i-${i}`, setCode: 'TEST', cardNumber: String(i), name: `Card ${i}`,
    }))
    setState({ sideboardScreen: makeScreen({ maindeck }) })
    const { container } = render(<SideboardScreen />)
    expect(container.querySelector('.sideboard-filter')).toBeTruthy()
  })

  it('no auto-envía al llegar el SIDEBOARD en vivo (el timer aún vale 0 un render)', async () => {
    render(<SideboardScreen />)
    await act(async () => {
      setState({ sideboardScreen: makeScreen({ tableId: 't-live', timeLeft: 180 }) })
    })
    expect(vi.mocked(submitDeck)).not.toHaveBeenCalled()
  })

  it('auto-envía una sola vez al expirar el timer', async () => {
    vi.useFakeTimers()
    try {
      render(<SideboardScreen />)
      await act(async () => {
        setState({ sideboardScreen: makeScreen({ tableId: 't-live', timeLeft: 3 }) })
      })
      expect(vi.mocked(submitDeck)).not.toHaveBeenCalled()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      expect(submitDeck).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  function legalMaindeck() {
    return Array.from({ length: 60 }, (_, i) => ({
      instanceId: `m-${i}`, setCode: 'TEST', cardNumber: String(i), name: `Card ${i}`,
    }))
  }

  it('shows a waiting-for-opponent state after submitting, instead of going blank', async () => {
    setState({ sideboardScreen: makeScreen({ maindeck: legalMaindeck() }) })
    const { container } = render(<SideboardScreen />)
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enviar mazo')!
    await act(async () => {
      fireEvent.click(submitBtn)
    })
    expect(submitDeck).toHaveBeenCalledTimes(1)
    // The screen must NOT be nulled out (that would leave nothing rendered
    // until the next GAME_INIT); it stays mounted showing a waiting message.
    expect(container.querySelector('.sideboard-backdrop')).toBeTruthy()
    expect(container.querySelector('.sideboard-waiting')).toBeTruthy()
    expect(container.textContent).toContain('esperando al rival')
    // The deck-editing UI (submit button, timer) is gone while waiting.
    expect(container.textContent).not.toContain('Enviar mazo')
  })

  it('does not double-submit if the timer keeps ticking after submission', async () => {
    vi.useFakeTimers()
    try {
      setState({ sideboardScreen: makeScreen({ tableId: 't-live', timeLeft: 3, maindeck: legalMaindeck() }) })
      const { container } = render(<SideboardScreen />)
      const submitBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enviar mazo')!
      await act(async () => {
        fireEvent.click(submitBtn)
      })
      expect(submitDeck).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      // The auto-submit-on-timeout effect must not fire again once submitted.
      expect(submitDeck).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets the waiting state when a new SIDEBOARD event arrives for the next game of the match', async () => {
    setState({ sideboardScreen: makeScreen({ tableId: 'match-1', maindeck: legalMaindeck() }) })
    const { container } = render(<SideboardScreen />)
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enviar mazo')!
    await act(async () => {
      fireEvent.click(submitBtn)
    })
    expect(container.querySelector('.sideboard-waiting')).toBeTruthy()

    // Same tableId (same Bo3 match), but a fresh SIDEBOARD event/object for game 2.
    await act(async () => {
      setState({ sideboardScreen: makeScreen({ tableId: 'match-1', maindeck: legalMaindeck() }) })
    })
    expect(container.querySelector('.sideboard-waiting')).toBeNull()
    expect(container.textContent).toContain('Enviar mazo')
  })
})
