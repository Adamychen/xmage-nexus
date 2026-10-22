import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DeckBuilder from './DeckBuilder'
import type { DeckValidationResult } from '../net/types'

const validation = vi.hoisted(() => ({ deck: vi.fn(), format: vi.fn() }))

vi.mock('./deckIssues', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./deckIssues')>()),
  fetchDeckIssues: validation.deck,
  fetchFormatIssues: validation.format,
}))

const mocks = vi.hoisted(() => ({
  deck: {
    id: 'd1',
    name: 'Mazo Original',
    format: 'Freeform' as const,
    cards: [] as unknown[],
    sideboard: [] as unknown[],
    coverCard: null,
    commanderCard: null,
    partnerCard: null,
    updatedAt: 0,
  },
  put: vi.fn(async (_d: unknown) => {}),
}))

vi.mock('./storage', () => ({
  getDeckStorage: () => ({
    get: async () => ({ ...mocks.deck }),
    put: mocks.put,
    list: async () => [],
  }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

const report = (cardName: string): DeckValidationResult => ({
  ready: true,
  missing: [{ cardName, setCode: 'AAA', cardNumber: '1', amount: 1, reason: 'OUTDATED_PRINTING' }],
  mismatches: [],
})

describe('DeckBuilder · validation answers that arrive out of order', () => {
  afterEach(() => {
    cleanup()
    validation.deck.mockReset()
    validation.format.mockReset()
  })

  it('keeps the answer of the latest request when an older one resolves last', async () => {
    const first = deferred<DeckValidationResult | null>()
    const second = deferred<DeckValidationResult | null>()
    validation.deck.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    validation.format.mockResolvedValue(null)

    render(<DeckBuilder deckId="d1" onClose={vi.fn()} />)
    const input = await screen.findByDisplayValue('Mazo Original')
    await waitFor(() => expect(validation.deck).toHaveBeenCalledTimes(1))

    fireEvent.change(input, { target: { value: 'Mazo Editado' } })
    await waitFor(() => expect(validation.deck).toHaveBeenCalledTimes(2), { timeout: 4000 })

    await act(async () => { second.resolve(report('Fresh Card')) })
    await act(async () => { first.resolve(report('Stale Card')) })

    const issues = await screen.findByTestId('builder-server-issues')
    expect(issues.textContent).toContain('Fresh Card')
    expect(issues.textContent).not.toContain('Stale Card')
  })
})
