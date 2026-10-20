import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DeckServerIssues from './DeckServerIssues'
import type { ServerIssueItem } from './useDeckValidation'

describe('DeckServerIssues', () => {
  afterEach(() => {
    cleanup()
  })

  const trostaniIssue: ServerIssueItem = {
    kind: 'missing',
    name: "Trostani, Selesnya's Voice",
    set: 'SLD',
    num: '2429',
    amount: 1,
    message: 'Esa impresión (set/número) no existe',
    to: { cardName: "Trostani, Selesnya's Voice", setCode: 'C19', cardNumber: '204' },
    fixes: [
      {
        from: { cardName: "Trostani, Selesnya's Voice", setCode: 'SLD', cardNumber: '2429' },
        to: { cardName: "Trostani, Selesnya's Voice", setCode: 'C19', cardNumber: '204' },
      },
    ],
  }

  it('renders the issue and suggestion button', () => {
    render(<DeckServerIssues issues={[trostaniIssue]} onRepair={vi.fn()} />)
    expect(screen.getByText(/Trostani, Selesnya's Voice/)).toBeDefined()
    expect(screen.getByTestId('builder-issue-auto-resolve')).toBeDefined()
    expect(screen.getByTestId('builder-issue-repair')).toBeDefined()
  })

  it('optimistically hides repaired item when individual repair is clicked', () => {
    const onRepair = vi.fn()
    render(<DeckServerIssues issues={[trostaniIssue]} onRepair={onRepair} />)
    fireEvent.click(screen.getByTestId('builder-issue-repair'))
    expect(onRepair).toHaveBeenCalledWith(trostaniIssue.fixes)
    // Banner should disappear because all fixable issues are repaired
    expect(screen.queryByTestId('builder-server-issues')).toBeNull()
  })

  it('optimistically hides all items when Auto-resolver is clicked', () => {
    const onRepair = vi.fn()
    render(<DeckServerIssues issues={[trostaniIssue]} onRepair={onRepair} />)
    fireEvent.click(screen.getByTestId('builder-issue-auto-resolve'))
    expect(onRepair).toHaveBeenCalledWith(trostaniIssue.fixes)
    expect(screen.queryByTestId('builder-server-issues')).toBeNull()
  })
})
