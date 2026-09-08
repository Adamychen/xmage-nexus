import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ActiveTablesBar from './ActiveTablesBar'
import type { TableView } from '../net/types'

afterEach(() => {
  cleanup()
})

const MOCK_WAITING_TABLE: TableView = {
  tableId: 'tab-1',
  tableName: 'Alice Modern Duel',
  controllerName: 'Alice',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Modern',
  additionalInfoShort: '',
  additionalInfoFull: '',
  createTime: Date.now() - 60000,
  tableState: 'WAITING',
  skillLevel: 'CASUAL',
  tableStateText: 'Waiting for players',
  seatsInfo: '1/2',
  isTournament: false,
  seats: [
    { playerName: 'Alice', seatIndex: 0, playerType: 'HUMAN' },
    { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
  ],
  games: [],
  quitRatio: '0%',
  minimumRating: '0',
  limited: false,
  rated: false,
  passworded: false,
  spectatorsAllowed: true,
}

const MOCK_READY_TABLE: TableView = {
  ...MOCK_WAITING_TABLE,
  tableId: 'tab-2',
  tableName: 'Alice vs Bob Standard',
  tableState: 'READY_TO_START',
  tableStateText: 'Ready',
  seatsInfo: '2/2',
  seats: [
    { playerName: 'Alice', seatIndex: 0, playerType: 'HUMAN' },
    { playerName: 'Bob', seatIndex: 1, playerType: 'HUMAN' },
  ],
}

const MOCK_DUELING_TABLE: TableView = {
  ...MOCK_WAITING_TABLE,
  tableId: 'tab-3',
  tableName: 'Alice vs Charlie Pauper',
  tableState: 'DUELING',
  tableStateText: 'Dueling',
  seatsInfo: '2/2',
}

describe('ActiveTablesBar', () => {
  it('returns null when there are no tables', () => {
    const { container } = render(
      <ActiveTablesBar
        tables={[]}
        onOpenStaging={vi.fn()}
        onStart={vi.fn()}
        onWatch={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders waiting table with staging button', () => {
    const onOpenStaging = vi.fn()
    const { container } = render(
      <ActiveTablesBar
        tables={[MOCK_WAITING_TABLE]}
        onOpenStaging={onOpenStaging}
        onStart={vi.fn()}
        onWatch={vi.fn()}
      />,
    )

    expect(screen.getByText('Alice Modern Duel')).toBeTruthy()
    const btn = container.querySelector('.btn-staging') as HTMLButtonElement
    expect(btn).not.toBeNull()
    fireEvent.click(btn)
    expect(onOpenStaging).toHaveBeenCalledWith('tab-1')
  })

  it('renders ready table with start button and staging button', () => {
    const onStart = vi.fn()
    const { container } = render(
      <ActiveTablesBar
        tables={[MOCK_READY_TABLE]}
        onOpenStaging={vi.fn()}
        onStart={onStart}
        onWatch={vi.fn()}
      />,
    )

    expect(screen.getByText('Alice vs Bob Standard')).toBeTruthy()
    const startBtn = container.querySelector('.btn-start') as HTMLButtonElement
    expect(startBtn).not.toBeNull()
    fireEvent.click(startBtn)
    expect(onStart).toHaveBeenCalledWith(MOCK_READY_TABLE)
  })

  it('renders dueling table with resume/watch button', () => {
    const onWatch = vi.fn()
    const { container } = render(
      <ActiveTablesBar
        tables={[MOCK_DUELING_TABLE]}
        onOpenStaging={vi.fn()}
        onStart={vi.fn()}
        onWatch={onWatch}
      />,
    )

    expect(screen.getByText('Alice vs Charlie Pauper')).toBeTruthy()
    const resumeBtn = container.querySelector('.btn-resume') as HTMLButtonElement
    expect(resumeBtn).not.toBeNull()
    fireEvent.click(resumeBtn)
    expect(onWatch).toHaveBeenCalledWith(MOCK_DUELING_TABLE)
  })

  it('renders multiple active tables', () => {
    render(
      <ActiveTablesBar
        tables={[MOCK_WAITING_TABLE, MOCK_READY_TABLE, MOCK_DUELING_TABLE]}
        onOpenStaging={vi.fn()}
        onStart={vi.fn()}
        onWatch={vi.fn()}
      />,
    )

    expect(screen.getByText('Alice Modern Duel')).toBeTruthy()
    expect(screen.getByText('Alice vs Bob Standard')).toBeTruthy()
    expect(screen.getByText('Alice vs Charlie Pauper')).toBeTruthy()
  })
})
