import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConstructScreen, { completeMainWithBasics, poolToDeckCards, restoreConstructSelection } from './ConstructScreen'
import { setState } from '../state/store'
import { clearActiveConstruct, saveConstructSelection } from '../state/persistence'
import { submitDeck } from '../net/commands'
import type { CardStripMeta } from '../decks/ArenaCardStrip'

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

describe('ConstructScreen — restore del armado en curso', () => {
  const serverPool = [
    { cardName: 'Pool Card 100', setCode: 'M21', cardNumber: '101', amount: 1 },
    { cardName: 'Pool Card 101', setCode: 'M21', cardNumber: '102', amount: 2 },
  ]

  it('restaura main y pool tal como se guardaron cuando el pool del server sigue igual', () => {
    const saved = {
      main: [{ cardName: 'Pool Card 101', setCode: 'M21', cardNumber: '102', amount: 1 }],
      pool: [{ cardName: 'Pool Card 101', setCode: 'M21', cardNumber: '102', amount: 1 }],
    }
    expect(restoreConstructSelection(serverPool, saved)).toEqual(saved)
  })

  it('descarta cartas que ya no están en el pool del server y recorta cantidades', () => {
    const saved = {
      main: [
        { cardName: 'Gone Card', setCode: 'M21', cardNumber: '9', amount: 1 },
        { cardName: 'Pool Card 101', setCode: 'M21', cardNumber: '102', amount: 5 },
      ],
      pool: [{ cardName: 'Pool Card 100', setCode: 'M21', cardNumber: '101', amount: 2 }],
    }
    expect(restoreConstructSelection(serverPool, saved)).toEqual({
      main: [{ cardName: 'Pool Card 101', setCode: 'M21', cardNumber: '102', amount: 2 }],
      pool: [{ cardName: 'Pool Card 100', setCode: 'M21', cardNumber: '101', amount: 1 }],
    })
  })

  it('conserva las básicas del adder aunque no estén en el pool', () => {
    const saved = {
      main: [{ cardName: 'Plains', setCode: 'DMU', cardNumber: '277', amount: 12 }],
      pool: [],
    }
    expect(restoreConstructSelection(serverPool, saved)).toEqual({
      main: [{ cardName: 'Plains', setCode: 'DMU', cardNumber: '277', amount: 12 }],
      pool: [],
    })
  })

  it('al montar con un armado guardado del mismo construct lo pinta de nuevo', () => {
    clearActiveConstruct()
    saveConstructSelection('t-restore', {
      main: [{ cardName: 'Plains', setCode: 'DMU', cardNumber: '277', amount: 3 }],
      pool: [{ cardName: 'Pool Card 100', setCode: 'M21', cardNumber: '101', amount: 1 }],
    })
    const { container } = render(<ConstructScreen />)
    act(() => {
      setState({
        construct: {
          deckName: 'Pool',
          pool: { 'i-1': { id: 'i-1', name: 'Pool Card 100', expansionSetCode: 'M21', cardNumber: '101' } },
          tableId: 't-restore',
          parentTableId: null,
          timeLeft: 600,
        },
      } as never)
    })
    expect(container.querySelector('.basic-land-btn-count')?.textContent).toBe('3')
    expect((screen.getByTestId('construct-submit') as HTMLButtonElement).disabled).toBe(true)
    clearActiveConstruct()
  })
})

describe('ConstructScreen — auto-submit on timer expiry', () => {
  it('shows the error banner when the expiry auto-submit is rejected', async () => {
    vi.mocked(submitDeck).mockResolvedValueOnce({ ok: false, error: 'Deck is not legal' } as never)
    vi.useFakeTimers()
    try {
      setState({ construct: null } as never)
      render(<ConstructScreen />)
      await act(async () => {
        setState({
          construct: { deckName: 'Pool', pool: {}, tableId: 't-expire', parentTableId: null, timeLeft: 3 },
        } as never)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
    } finally {
      vi.useRealTimers()
    }
    expect(submitDeck).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('construct-submit-error').textContent).toContain('Deck is not legal')
  })
})

describe('completeMainWithBasics', () => {
  const meta = new Map([
    ['IMA/165', { manaCost: '{1}{G}', typeLine: 'Creature — Bear' }],
  ]) as never as Map<string, CardStripMeta>

  it('fills a short main with basics for its colours up to the minimum', () => {
    const main = [{ cardName: 'Grizzly Bears', setCode: 'IMA', cardNumber: '165', amount: 10 }]
    const result = completeMainWithBasics(main, 40, meta)
    expect(result.reduce((sum, c) => sum + c.amount, 0)).toBe(40)
    expect(result[0]).toEqual(main[0])
    expect(result.find((c) => c.cardName === 'Forest')?.amount).toBe(30)
  })

  it('leaves a main that already meets the minimum untouched', () => {
    const main = [{ cardName: 'Grizzly Bears', setCode: 'IMA', cardNumber: '165', amount: 40 }]
    expect(completeMainWithBasics(main, 40, meta)).toBe(main)
  })

  it('returns the main unchanged when there are no colours to derive basics from', () => {
    expect(completeMainWithBasics([], 40, meta)).toEqual([])
  })
})
