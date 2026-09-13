import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConstructScreen, { poolToDeckCards } from './ConstructScreen'
import { setState } from '../state/store'
import { submitDeck } from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  submitDeck: vi.fn(async () => ({ ok: true })),
}))

function showConstruct() {
  setState({
    construct: { deckName: 'Draft Pool', pool: {}, tableId: 't1', parentTableId: null, timeLeft: 600 },
  } as never)
  return render(<ConstructScreen />)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  setState({ construct: null } as never)
})

describe('ConstructScreen — tierras básicas', () => {
  it('los botones +1 añaden básicas al main y el submit las envía', async () => {
    const { container } = showConstruct()
    const plainsBtn = container.querySelector('.basic-land-btn') as HTMLElement
    expect(plainsBtn).not.toBeNull()
    for (let i = 0; i < 40; i++) fireEvent.click(plainsBtn)
    const submit = screen.getByTestId('construct-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    expect(submitDeck).toHaveBeenCalledTimes(1)
    const [, deck] = vi.mocked(submitDeck).mock.calls[0] as unknown as [string, { cards: { cardName: string; setCode: string; cardNumber: string; amount: number }[] }]
    expect(deck.cards).toEqual([{ cardName: 'Plains', setCode: 'DMU', cardNumber: '277', amount: 40 }])
  })

  it('el botón -1 retira básicas del main hasta eliminar la entrada', () => {
    const { container } = showConstruct()
    const plainsBtn = container.querySelector('.basic-land-btn') as HTMLElement
    fireEvent.click(plainsBtn)
    fireEvent.click(plainsBtn)
    fireEvent.click(container.querySelector('.basic-land-dec-btn') as HTMLElement)
    expect(container.querySelector('.basic-land-dec-btn')).not.toBeNull()
    fireEvent.click(container.querySelector('.basic-land-dec-btn') as HTMLElement)
    expect(container.querySelector('.basic-land-dec-btn')).toBeNull()
  })

  it('no auto-envía al llegar el CONSTRUCT en vivo (el timer aún vale 0 un render)', async () => {
    setState({ construct: null } as never)
    render(<ConstructScreen />)
    await act(async () => {
      setState({
        construct: { deckName: 'Pool', pool: {}, tableId: 't-live', parentTableId: null, timeLeft: 600 },
      } as never)
    })
    expect(vi.mocked(submitDeck)).not.toHaveBeenCalled()
  })

  it('auto-envía una sola vez al expirar el timer', async () => {
    vi.useFakeTimers()
    try {
      setState({ construct: null } as never)
      render(<ConstructScreen />)
      await act(async () => {
        setState({
          construct: { deckName: 'Pool', pool: {}, tableId: 't-live', parentTableId: null, timeLeft: 3 },
        } as never)
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
})

describe('ConstructScreen — pool CONSTRUCT sin nombres (engine SimpleCardsView)', () => {
  it('agrupa por impresión con "SET número" en vez de un UUID por carta', () => {
    const pool = {
      'i-1': { id: 'i-1', expansionSetCode: 'M20', cardNumber: '34' },
      'i-2': { id: 'i-2', expansionSetCode: 'M20', cardNumber: '34' },
      'i-3': { id: 'i-3', expansionSetCode: 'M20', cardNumber: '35' },
    }
    const cards = poolToDeckCards(pool)
    expect(cards).toEqual([
      { cardName: 'M20 34', setCode: 'M20', cardNumber: '34', amount: 2 },
      { cardName: 'M20 35', setCode: 'M20', cardNumber: '35', amount: 1 },
    ])
    expect(cards.some((c) => /-/i.test(c.cardName) && c.cardName.length > 30)).toBe(false)
  })

  it('conserva el nombre cuando el engine sí lo trae', () => {
    const pool = {
      'i-1': { id: 'i-1', name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' },
    }
    expect(poolToDeckCards(pool)).toEqual([
      { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 1 },
    ])
  })
})
