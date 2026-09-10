import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConstructScreen from './ConstructScreen'
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
})
