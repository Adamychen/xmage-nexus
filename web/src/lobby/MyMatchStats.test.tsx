// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import MyMatchStats from './MyMatchStats'
import { matchHistoryStore } from '../system/matchHistory'

const record = (n: number, over: Record<string, unknown> = {}) => ({
  endedAt: 1000 + n,
  gameId: `game${n}xxxx`,
  deckName: 'Burn',
  format: 'Constructed - Modern',
  opponents: ['Bob'],
  result: 'win' as const,
  turns: 5,
  life: 10,
  ...over,
})

describe('MyMatchStats', () => {
  beforeEach(async () => {
    await matchHistoryStore.clear()
  })
  afterEach(cleanup)

  it('shows an empty state without recorded games', async () => {
    render(<MyMatchStats />)
    await waitFor(() => expect(screen.getByText(/Aún no hay partidas/)).not.toBeNull())
  })

  it('shows totals and switches the grouping', async () => {
    await matchHistoryStore.add(record(1))
    await matchHistoryStore.add(record(2, { result: 'loss', deckName: 'Elves', opponents: ['Cy'] }))
    await matchHistoryStore.add(record(3))
    render(<MyMatchStats />)
    await waitFor(() => expect(screen.getByText(/Victorias: 2/)).not.toBeNull())
    expect(screen.getByText(/Derrotas: 1/)).not.toBeNull()
    expect(screen.getAllByText(/67%/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Burn').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Por rival' }))
    expect(screen.getAllByText('Cy').length).toBeGreaterThan(0)
  })
})
